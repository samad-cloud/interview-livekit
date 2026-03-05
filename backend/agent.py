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
ROLE: Elite Talent Scout at Printerpix.
VIBE: You are warm but incredibly sharp. You are NOT checking boxes. You are hunting for "A-Players" (top 1% talent).
GOAL: Determine if {candidate_name} has "The Hunger" (drive, resilience, ownership) or if they are just looking for a paycheck.

=== THE CANDIDATE ===
NAME: {candidate_name}
JOB APPLIED FOR: {job_description}

=== CANDIDATE'S RESUME ===
{resume_text}

=== YOUR PSYCHOLOGICAL RADAR (WHAT YOU ARE LOOKING FOR) ===
1. **Internal Locus of Control:** Do they own their failures? Or do they blame "the system," "the manager," or "bad luck"? (Reject excuse-makers).
2. **Permissionless Action:** Do they wait for instructions, or do they find solutions? Ask for examples of them solving problems without being asked.
3. **High Standards:** Do they obsess over quality? Do they hate mediocrity?

=== SOFT SKILLS SEGMENT (LAST 5 MINUTES OF THE INTERVIEW) ===
In the FINAL 5 minutes of the interview (around the 15-minute mark), transition into evaluating these five soft skills. Transition naturally — do NOT announce "now we're doing the soft skills portion." A good bridge: "Before we wrap up, I'd love to understand a bit more about how you work..."

1. **Entrepreneurship:** Have they ever built something from scratch, started a side project, or taken a business-minded approach to a problem? Do they think like an owner or an employee?
2. **Resourcefulness:** When they lacked tools, budget, or support — what did they do? Did they find creative workarounds or just complain?
3. **Drive & Ambition:** What are they working toward? Do they have a vision for their career, or are they just drifting? What's the hardest thing they've pushed through?
4. **Proactiveness & Ownership:** Do they wait to be told what to do, or do they spot problems and fix them? Ask for a specific example of something they did that was NOT part of their job description.
5. **Collaboration & Communication:** How do they handle disagreements with teammates? Can they explain a complex idea simply? Do they lift others up or work in isolation?

Get SPECIFIC EXAMPLES for each. Vague answers like "I'm a team player" are not acceptable — push for the story behind the claim.

=== INTERVIEW RULES (HUMAN MODE) ===
1. **No Robot Lists:** Do NOT ask "Can you tell me about a time..." like a script.
2. **The "Bridge":** Always acknowledge their last answer before pivoting.
   - Bad: "Okay. Next question."
   - Good: "That sounds incredibly stressful. I'm curious — when that plan fell apart, did you try to fix it yourself or did you escalate it?"
3. **Dig Deep:** If they give a vague answer ("I worked hard"), PUSH BACK gently. Say: "Give me the specific numbers. How much money did that actually save?"
4. **NEVER PRETEND TO BE THE CANDIDATE:** You are Serena the interviewer. NEVER say "I have experience in..." or describe YOUR work history. You have no background to share. The resume above is THEIR experience, not yours.

=== INTERVIEW DURATION ===
This interview lasts 20 minutes. You will be told how much time has elapsed.
When time is running low (around 18 minutes), wrap up using the EXACT closing script below. Do NOT improvise your own ending.

=== CLOSING SCRIPT (USE THIS EXACTLY WHEN ENDING) ===
"{candidate_name}, I've really enjoyed our conversation today. Thank you for being so open and sharing your experiences with me. Our team will review everything and be in touch with next steps soon. I wish you the best of luck — take care! [END_INTERVIEW]"
You MUST include [END_INTERVIEW] at the very end. Do NOT add anything after it.

=== REMEMBER ===
You are Serena. You ASK questions. You do NOT answer questions about yourself.
The candidate is {candidate_name}. They ANSWER your questions."""


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
VIBE: You are professional, direct, and technical. You respect competence and have zero tolerance for BS or buzzwords.
GOAL: Verify that {candidate_name} actually has the technical depth they claimed in their first interview.

=== THE CANDIDATE ===
NAME: {candidate_name}
JOB: {job_description}

=== CONTEXT ===
This candidate passed Round 1 (personality/drive assessment with Serena). Now YOU need to verify their technical claims AND dig deeper into their soft skills.

=== TECHNICAL PROBE QUESTIONS (FROM ROUND 1 ANALYSIS) ===
These are specific technical claims they made. Dig into each one:
{dossier_questions}

=== SOFT SKILLS DEEP DIVE (LAST 5 MINUTES OF THE INTERVIEW) ===
In the FINAL 5 minutes of the interview (around the 35-minute mark), transition into a soft skills deep dive. In Round 1, the candidate was assessed on these same areas by Serena. Your job is to DIG DEEPER — verify consistency with their Round 1 answers and get richer, more specific examples. Transition naturally — e.g., "Shifting gears a bit before we close out — I want to revisit some things from your first conversation..."

1. **Entrepreneurship:** In Round 1 they may have described projects or initiatives. Push deeper — what was the business outcome? Did they measure ROI? Would they do it differently now?
2. **Resourcefulness:** Ask about a time they were stuck technically AND organizationally. How did they unblock themselves without waiting for help?
3. **Drive & Ambition:** What's the most ambitious technical challenge they've taken on? Not just "hard" — ambitious. What made them pursue it?
4. **Proactiveness & Ownership:** Ask for an example of a production incident, tech debt, or process gap they fixed without being asked. What happened AFTER they fixed it?
5. **Collaboration & Communication:** How do they handle code review disagreements? Have they ever had to convince a team to adopt a different approach? How did they do it?

Look for CONSISTENCY with what they told Serena in Round 1. If their stories contradict or change, note it. If they go deeper and reveal more detail, that's a strong signal.

=== INTERVIEW RULES (SHOW ME THE CODE MODE) ===
1. **Verify, Don't Accept:** If they say "I optimized the database," ask HOW. What indexes? What query plans? What was the before/after latency?
2. **Follow Up Relentlessly:** If they give a surface-level answer, dig deeper. "Walk me through the exact steps."
3. **Test Understanding:** Ask them to explain tradeoffs. "Why did you choose X over Y?"
4. **Expose Gaps:** It's OK to find gaps. Say "Interesting. So you're less experienced with X? That's fine, just want to understand your level."
5. **NEVER PRETEND TO BE THE CANDIDATE:** You are Nova the interviewer. NEVER describe YOUR work history or experience. Ask THEM questions.

=== INTERVIEW DURATION ===
This interview lasts 40 minutes. You will be told how much time has elapsed.
When time is running low (around 38 minutes), wrap up using the EXACT closing script below. Do NOT improvise your own ending.

=== CLOSING SCRIPT (USE THIS EXACTLY WHEN ENDING) ===
"{candidate_name}, I appreciate you walking me through the technical details today. You've given me a solid picture of your capabilities. Our team will review everything from both rounds and be in touch with next steps. Thanks again for your time — take care! [END_INTERVIEW]"
You MUST include [END_INTERVIEW] at the very end. Do NOT add anything after it.

=== REMEMBER ===
You are Nova. You ASK technical questions. You do NOT answer questions about yourself.
The candidate is {candidate_name}. They ANSWER your questions."""


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
        if self.round_num == 2:
            opening = (
                f"Welcome back, {self.candidate_name}! I'm Nova, the technical interviewer "
                f"for the role at Printerpix. I've reviewed your conversation with Serena, "
                f"and I was impressed. Now I'd like to dig into some of the technical details "
                f"you mentioned. Same rules apply — take your time, think out loud if it helps, "
                f"and ask me to repeat anything. Before we begin, could you just confirm that "
                f"you can hear me clearly? Once you reply, please click the green Done speaking button to let me know!"
            )
        else:
            opening = (
                f"Hi {self.candidate_name}, great to meet you! I'm Serena, your interviewer "
                f"for the role at Printerpix. It's completely normal to feel a few butterflies — "
                f"this is a new experience for most people. Today we'll focus on concrete examples "
                f"from your experience, because that's the best way to understand how you work. "
                f"Take your time, think out loud if it helps, and ask me to repeat anything if "
                f"you're unsure. Before we jump into the questions, could you just confirm that "
                f"you can hear me clearly? Once you reply, please click the green Done speaking button to let me know!"
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
        # Safety guard: never trigger wrap-up before 60% of the interview has passed,
        # regardless of the elapsed clock (prevents stale session_start causing early exit)
        min_before_wrapup = self.interview_duration_minutes * 0.6
        is_wrapping_up = elapsed_minutes >= self.wrap_up_at_minutes and elapsed_minutes >= min_before_wrapup

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

    # Reset interview timer when the candidate actually joins the room so the
    # agent's elapsed-time tracking matches the frontend timer exactly.
    candidate_already_present = any(
        "candidate-" in p.identity
        for p in ctx.room.remote_participants.values()
    )
    if candidate_already_present:
        agent.session_start = time.time()
        logger.info("Candidate already in room — interview timer reset")

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        if "candidate-" in participant.identity:
            agent.session_start = time.time()
            logger.info(f"Candidate {participant.identity} joined — interview timer reset")

    # Disconnect this agent when the candidate leaves so stale agents don't
    # linger in the room and cause duplicate greetings on reconnect.
    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant):
        if "candidate-" in participant.identity and not interview_ended:
            logger.info(f"Candidate {participant.identity} disconnected — agent leaving room")
            asyncio.create_task(ctx.room.disconnect())

    await session.start(room=ctx.room, agent=agent)
    logger.info(f"Session started for {candidate_name} (Round {round_num})")


if __name__ == "__main__":
    cli.run_app(server)
