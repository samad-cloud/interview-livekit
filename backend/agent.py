#!/usr/bin/env python3
"""
LiveKit Interview Agent — replaces the manual Deepgram/Gemini/TTS pipeline.

Runs as a separate Railway service. Connects to LiveKit rooms when candidates join
and conducts the voice interview using Deepgram STT, Gemini LLM, and Deepgram TTS.
"""

import asyncio
import json
import logging
import time
from typing import Optional

from livekit import api, rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    llm,
    metrics,
)
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.plugins import deepgram, google, silero

logger = logging.getLogger("interview-agent")
logger.setLevel(logging.INFO)


def build_serena_prompt(candidate_name: str, job_description: str, resume_text: str) -> str:
    """Build Round 1 interviewer system prompt (Serena — personality/drive)."""
    return f"""=== YOUR IDENTITY ===
NAME: Serena
ROLE: Head of People & Culture at Printerpix.
VIBE: You are warm, curious, and perceptive. You are NOT a robot reading from a script.
GOAL: Discover if {candidate_name} has the drive, accountability, and initiative to succeed at Printerpix.

=== THE CANDIDATE ===
NAME: {candidate_name}
JOB APPLIED FOR: {job_description}

=== CANDIDATE'S RESUME ===
{resume_text}

=== EVALUATION FRAMEWORK ===
Focus on these three core traits in the FIRST 15 minutes:
1. **Internal Locus of Control:** Do they own their failures, or blame the system?
2. **Permissionless Action:** Do they wait for instructions, or find solutions themselves?
3. **High Standards:** Do they obsess over quality? Do they hate mediocrity?

=== SOFT SKILLS SEGMENT (LAST 5 MINUTES) ===
In the FINAL 5 minutes (around the 15-minute mark), transition naturally:
"Before we wrap up, I'd love to understand a bit more about how you work..."
Evaluate: Entrepreneurship, Resourcefulness, Drive & Ambition, Proactiveness, Collaboration.
Get SPECIFIC EXAMPLES. Vague answers like "I'm a team player" are unacceptable — push for the story.

=== INTERVIEW RULES ===
1. Never ask questions like a script. Be conversational.
2. Always acknowledge their last answer before pivoting.
3. If they give a vague answer, push back: "Give me the specific numbers."
4. NEVER describe YOUR work history. You are the interviewer, you ask questions.

=== INTERVIEW DURATION ===
This interview lasts 20 minutes. You will be told how much time has elapsed.
When time is running low (around 18 minutes), end with the EXACT closing script below.

=== CLOSING SCRIPT (USE EXACTLY WHEN ENDING) ===
"{candidate_name}, I've really enjoyed our conversation today. Thank you for being so open and sharing your experiences with me. Our team will review everything and be in touch with next steps soon. I wish you the best of luck — take care! [END_INTERVIEW]"
You MUST include [END_INTERVIEW] at the very end. Do NOT add anything after it.

=== REMEMBER ===
You are Serena. You ASK questions. You do NOT answer questions about yourself."""


def build_nova_prompt(
    candidate_name: str,
    job_description: str,
    resume_text: str,
    dossier: Optional[list],
) -> str:
    """Build Round 2 interviewer system prompt (Nova — technical depth)."""
    dossier_questions = ""
    if dossier:
        dossier_questions = "\n".join(f"- {q}" for q in dossier)
    else:
        dossier_questions = "(No specific probe questions — explore technical depth based on resume)"

    return f"""=== YOUR IDENTITY ===
NAME: Nova
ROLE: Senior Technical Architect at Printerpix.
VIBE: Professional, direct, technical. You respect competence and have zero tolerance for buzzwords.
GOAL: Verify that {candidate_name} actually has the technical depth they claimed in Round 1.

=== THE CANDIDATE ===
NAME: {candidate_name}
JOB: {job_description}

=== TECHNICAL PROBE QUESTIONS (FROM ROUND 1 ANALYSIS) ===
{dossier_questions}

=== SOFT SKILLS DEEP DIVE (LAST 5 MINUTES) ===
In the FINAL 5 minutes (around the 35-minute mark), transition naturally:
"Shifting gears a bit before we close out — I want to revisit some things from your first conversation..."
Look for CONSISTENCY with Round 1. If stories contradict, note it.

=== INTERVIEW RULES ===
1. Verify, Don't Accept: If they say "I optimized the database," ask HOW.
2. Follow Up Relentlessly: "Walk me through the exact steps."
3. Test Understanding: "Why did you choose X over Y?"
4. NEVER describe YOUR work history. You are the interviewer.

=== INTERVIEW DURATION ===
This interview lasts 40 minutes. You will be told how much time has elapsed.
When time is running low (around 38 minutes), end with EXACT closing script below.

=== CLOSING SCRIPT (USE EXACTLY WHEN ENDING) ===
"{candidate_name}, I appreciate you walking me through the technical details today. Our team will review everything from both rounds and be in touch with next steps. Thanks again — take care! [END_INTERVIEW]"
You MUST include [END_INTERVIEW] at the very end. Do NOT add anything after it.

=== REMEMBER ===
You are Nova. You ASK technical questions. You do NOT answer questions about yourself."""


def preinit_model(proc: JobProcess):
    """Called once when the worker process starts — pre-load VAD model."""
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    """Called for each new interview room."""
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f"Agent connected to room: {ctx.room.name}")

    # Parse room metadata
    raw_meta = ctx.room.metadata or "{}"
    try:
        meta = json.loads(raw_meta)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse room metadata: {raw_meta}")
        return

    candidate_name = meta.get("candidateName", "Candidate")
    round_num = int(meta.get("round", 1))
    job_description = meta.get("jobDescription", "")
    resume_text = meta.get("resumeText", "")
    dossier = meta.get("dossier", None)
    custom_prompt = meta.get("systemPrompt", None)

    # Build system prompt
    if custom_prompt:
        system_prompt = custom_prompt
    elif round_num == 2:
        system_prompt = build_nova_prompt(candidate_name, job_description, resume_text, dossier)
    else:
        system_prompt = build_serena_prompt(candidate_name, job_description, resume_text)

    interviewer_name = "Nova" if round_num == 2 else "Serena"
    interview_duration_minutes = 40 if round_num == 2 else 20
    wrap_up_at_minutes = 38 if round_num == 2 else 18

    # Track session state
    session_start = time.time()
    interview_ended = False
    transcript: list[dict] = []

    # Initial chat context
    initial_ctx = llm.ChatContext().append(role="system", text=system_prompt)

    async def send_data(payload: dict):
        """Send a data message to all participants in the room."""
        data = json.dumps(payload).encode()
        await ctx.room.local_participant.publish_data(data, reliable=True)

    async def before_llm_cb(agent: VoicePipelineAgent, chat_ctx: llm.ChatContext):
        """Inject elapsed time into LLM context before each call."""
        nonlocal interview_ended
        elapsed_minutes = (time.time() - session_start) / 60
        is_wrapping_up = elapsed_minutes >= wrap_up_at_minutes

        time_msg = (
            f"\n=== TIME STATUS ===\n"
            f"Elapsed: {elapsed_minutes:.0f} minutes of {interview_duration_minutes}-minute interview.\n"
        )
        if is_wrapping_up:
            time_msg += (
                f"STATUS: TIME IS ALMOST UP. You MUST wrap up NOW. "
                f"Deliver your closing statement and end with [END_INTERVIEW].\n"
            )
        time_msg += "=== END TIME STATUS ==="

        # Inject as a system addendum (don't modify original system message)
        chat_ctx.messages.append(llm.ChatMessage(role="system", content=time_msg))

    async def on_agent_speech_committed(agent: VoicePipelineAgent, message: llm.ChatMessage):
        """Called after agent speaks — check for END_INTERVIEW signal."""
        nonlocal interview_ended

        text = message.content if isinstance(message.content, str) else str(message.content)

        # Forward transcript to frontend
        clean_text = text.replace("[END_INTERVIEW]", "").strip()
        if clean_text:
            entry = {"role": "interviewer", "speaker": interviewer_name, "text": clean_text}
            transcript.append(entry)
            await send_data({"type": "transcript", "entry": entry})

        # Detect end signal
        if "[END_INTERVIEW]" in text and not interview_ended:
            interview_ended = True
            logger.info("END_INTERVIEW detected — signalling frontend")
            await send_data({"type": "end_interview", "transcript": transcript})
            # Give frontend 3 seconds to handle the signal before disconnecting
            await asyncio.sleep(3)
            await ctx.room.disconnect()

    async def on_user_speech_committed(agent: VoicePipelineAgent, message: llm.ChatMessage):
        """Called after candidate finishes speaking (STT committed)."""
        text = message.content if isinstance(message.content, str) else str(message.content)
        if text.strip():
            entry = {"role": "candidate", "speaker": candidate_name, "text": text.strip()}
            transcript.append(entry)
            await send_data({"type": "transcript", "entry": entry})

    # Create the voice pipeline agent
    agent = VoicePipelineAgent(
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(model="nova-2", language="en-US"),
        llm=google.LLM(model="gemini-2.0-flash"),
        tts=deepgram.TTS(model="aura-2-thalia-en"),
        chat_ctx=initial_ctx,
        before_llm_cb=before_llm_cb,
    )

    agent.on("agent_speech_committed", on_agent_speech_committed)
    agent.on("user_speech_committed", on_user_speech_committed)

    # Wait for a participant to actually connect before starting
    await ctx.wait_for_participant()

    agent.start(ctx.room)
    logger.info(f"Agent started for {candidate_name} (Round {round_num})")

    # Opening greeting
    opening = (
        f"Hello {candidate_name}, I'm {interviewer_name}. "
        + ("I'll be conducting your technical interview today. Let's dive right in. " if round_num == 2
           else "I'll be your interviewer today. Let's get started. ")
        + "Can you start by telling me a bit about yourself and what drew you to this role?"
    )
    await agent.say(opening, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=preinit_model,
        )
    )