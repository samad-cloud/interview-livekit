#!/usr/bin/env python3
"""
LiveKit Interview Agent — livekit-agents 1.x API.

Runs as a separate Railway service. Connects to LiveKit rooms when candidates join
and conducts the voice interview using Deepgram STT, Gemini LLM, and Deepgram TTS.
"""

import asyncio
import json
import logging
import time
from typing import AsyncIterable, Optional

from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    ConversationItemAddedEvent,
    JobContext,
    ModelSettings,
    cli,
    llm,
)
from livekit.plugins import deepgram, google, silero

logger = logging.getLogger("interview-agent")
logger.setLevel(logging.INFO)

server = AgentServer()


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


class InterviewAgent(Agent):
    """Voice interview agent that injects elapsed time before each LLM call."""

    def __init__(
        self,
        *,
        system_prompt: str,
        interviewer_name: str,
        candidate_name: str,
        round_num: int,
        interview_duration_minutes: int,
        wrap_up_at_minutes: int,
        session_start: float,
    ):
        super().__init__(instructions=system_prompt)
        self.interviewer_name = interviewer_name
        self.candidate_name = candidate_name
        self.round_num = round_num
        self.interview_duration_minutes = interview_duration_minutes
        self.wrap_up_at_minutes = wrap_up_at_minutes
        self.session_start = session_start

    async def on_enter(self) -> None:
        """Speak opening greeting when agent enters the session."""
        opening = (
            f"Hello {self.candidate_name}, I'm {self.interviewer_name}. "
            + (
                "I'll be conducting your technical interview today. Let's dive right in. "
                if self.round_num == 2
                else "I'll be your interviewer today. Let's get started. "
            )
            + "Can you start by telling me a bit about yourself and what drew you to this role?"
        )
        await self.session.say(opening)

    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list,
        model_settings: ModelSettings,
    ) -> AsyncIterable[llm.ChatChunk]:
        """Inject elapsed time into context before each LLM inference."""
        elapsed_minutes = (time.time() - self.session_start) / 60
        is_wrapping_up = elapsed_minutes >= self.wrap_up_at_minutes

        time_msg = (
            f"\n=== TIME STATUS ===\n"
            f"Elapsed: {elapsed_minutes:.0f} minutes of {self.interview_duration_minutes}-minute interview.\n"
        )
        if is_wrapping_up:
            time_msg += (
                "STATUS: TIME IS ALMOST UP. You MUST wrap up NOW. "
                "Deliver your closing statement and end with [END_INTERVIEW].\n"
            )
        time_msg += "=== END TIME STATUS ==="

        chat_ctx.add_message(role="system", content=time_msg)

        async for chunk in Agent.default.llm_node(self, chat_ctx, tools, model_settings):
            yield chunk


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    """Called for each new interview room."""
    await ctx.connect()
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

    session_start = time.time()
    transcript: list[dict] = []
    interview_ended = False

    async def send_data(payload: dict):
        data = json.dumps(payload).encode()
        await ctx.room.local_participant.publish_data(data, reliable=True)

    # Load VAD (silero caches after first load)
    vad = silero.VAD.load(min_silence_duration=2.0)

    session = AgentSession(
        vad=vad,
        stt=deepgram.STT(model="nova-2", language="en-US"),
        llm=google.LLM(model="gemini-2.0-flash"),
        tts=deepgram.TTS(model="aura-2-thalia-en"),
    )

    async def _handle_conversation_item(event: ConversationItemAddedEvent):
        nonlocal interview_ended

        text = event.item.text_content
        if not text or not text.strip():
            return

        role = event.item.role  # "user" or "assistant"

        if role == "user":
            entry = {"role": "candidate", "speaker": candidate_name, "text": text.strip()}
            transcript.append(entry)
            await send_data({"type": "transcript", "entry": entry})

        elif role == "assistant":
            clean_text = text.replace("[END_INTERVIEW]", "").strip()
            if clean_text:
                entry = {"role": "interviewer", "speaker": interviewer_name, "text": clean_text}
                transcript.append(entry)
                await send_data({"type": "transcript", "entry": entry})

            if "[END_INTERVIEW]" in text and not interview_ended:
                interview_ended = True
                logger.info("END_INTERVIEW detected — signalling frontend")
                await send_data({"type": "end_interview", "transcript": transcript})
                await asyncio.sleep(3)
                await ctx.room.disconnect()

    @session.on("conversation_item_added")
    def on_conversation_item_added(event: ConversationItemAddedEvent):
        asyncio.create_task(_handle_conversation_item(event))

    agent = InterviewAgent(
        system_prompt=system_prompt,
        interviewer_name=interviewer_name,
        candidate_name=candidate_name,
        round_num=round_num,
        interview_duration_minutes=interview_duration_minutes,
        wrap_up_at_minutes=wrap_up_at_minutes,
        session_start=session_start,
    )

    await session.start(room=ctx.room, agent=agent)
    logger.info(f"Session started for {candidate_name} (Round {round_num})")


if __name__ == "__main__":
    cli.run_app(server)
