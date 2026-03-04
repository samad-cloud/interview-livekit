# LiveKit Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the manual Deepgram WebSocket + Gemini + MediaRecorder voice pipeline with LiveKit, giving us server-side recording (Egress), automatic reconnection, and a foundation for future video avatars.

**Architecture:** A new LiveKit Agent (Python) runs on Railway and handles the full STT→LLM→TTS pipeline for each interview session. The Next.js frontend connects to a LiveKit room and receives transcript data messages from the agent instead of managing its own Deepgram/Gemini connections. LiveKit Egress records each session server-side, eliminating the brittle browser-based chunk recording entirely.

**Tech Stack:**
- `livekit-server-sdk` (Node.js) — token generation + Egress API in Next.js
- `livekit-client` (browser) — WebRTC room connection in VoiceAvatar.tsx
- `livekit-agents` + `livekit-plugins-deepgram` + `livekit-plugins-google` + `livekit-plugins-silero` (Python) — interview agent on Railway
- LiveKit Cloud (managed server) OR self-hosted Railway (see Task 9)

---

## Context: What Changes vs. What Stays

**DELETED (replaced by LiveKit):**
- `frontend/app/api/chat/route.ts` — agent handles LLM
- `frontend/app/api/deepgram/route.ts` — agent handles STT
- `frontend/app/api/deepgram-tts/route.ts` — agent handles TTS
- `frontend/app/api/finalize-recording/route.ts` — Egress handles recording
- `frontend/app/api/save-recording-chunk/route.ts` — Egress handles recording
- `backend/video_fixer.py` — Egress produces clean files, no FFmpeg needed

**UNCHANGED (zero modifications):**
- All dashboard, screener, gen-job pages
- `/api/end-interview/route.ts` — still scores transcript, same POST body
- `/api/end-interview-round2/route.ts` — same
- `/api/tally-webhook/route.ts` — same
- All server actions (generateJob, generateDossier, generateFinalVerdict, etc.)
- `backend/listener.py` — minus video_fixer step
- Database schema — same columns, same values

**MODIFIED (targeted changes only):**
- `frontend/components/VoiceAvatar.tsx` — same UI, same props, replaces infrastructure
- `backend/listener.py` — remove Step 4 (video_fixer)
- `requirements.txt` — add livekit packages
- `frontend/package.json` — add livekit packages

**NEW:**
- `frontend/app/api/livekit/token/route.ts` — issues LiveKit access token + starts Egress
- `frontend/app/api/livekit/stop-egress/route.ts` — stops Egress recording on interview end
- `backend/agent.py` — LiveKit interview agent (Serena R1, Nova R2)

---

## Environment Variables Required

### Frontend (`frontend/.env.local`) — add these:
```
LIVEKIT_URL=wss://your-project.livekit.cloud        # or your Railway LiveKit URL
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud  # public, for browser SDK
```

### Backend (Railway agent service) — add these:
```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
DEEPGRAM_API_KEY=...  # same as existing
GEMINI_API_KEY=...    # same as existing
SUPABASE_URL=...      # same as existing
SUPABASE_KEY=...      # same as existing
```

---

## Task 1: Install Frontend Dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install LiveKit browser SDK and server SDK**

```bash
cd frontend
npm install livekit-client livekit-server-sdk
```

**Step 2: Verify package.json has the new deps**

```bash
grep -E "livekit" frontend/package.json
```
Expected output:
```
"livekit-client": "^2.x.x",
"livekit-server-sdk": "^2.x.x",
```

**Step 3: Confirm build still compiles**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: Build succeeds (no new errors — existing code is unchanged at this point).

**Step 4: Commit**

```bash
git init  # if not already a git repo in the livekit copy
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add livekit-client and livekit-server-sdk dependencies"
```

---

## Task 2: Create LiveKit Token Endpoint

**Files:**
- Create: `frontend/app/api/livekit/token/route.ts`

**What this does:**
- Receives candidate data from VoiceAvatar
- Creates a LiveKit room (if not exists) with candidate metadata embedded
- Issues a participant token granting mic publish + audio subscribe
- Starts Egress recording for the room
- Returns `{ token, serverUrl, roomName, egressId }`

**Step 1: Create the directory**

```bash
mkdir -p frontend/app/api/livekit/token
```

**Step 2: Write the token route**

Create `frontend/app/api/livekit/token/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  AccessToken,
  EgressClient,
  RoomServiceClient,
  RoomCompositeEgressRequest,
  EncodedFileOutput,
  S3Upload,
} from 'livekit-server-sdk';

export async function POST(req: NextRequest) {
  const {
    candidateId,
    round,
    candidateName,
    jobTitle,
    jobDescription,
    resumeText,
    dossier,
    systemPrompt,
  } = await req.json();

  if (!candidateId || !round) {
    return NextResponse.json({ error: 'Missing candidateId or round' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const livekitUrl = process.env.LIVEKIT_URL!;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
  }

  const roomName = `interview-${candidateId}-r${round}`;

  // Metadata embedded in room — agent reads this to configure itself
  const roomMetadata = JSON.stringify({
    candidateId,
    round,
    candidateName,
    jobTitle,
    jobDescription,
    resumeText,
    dossier: dossier || null,
    systemPrompt: systemPrompt || null,  // optional: pass pre-built prompt
  });

  // Create the room with metadata
  const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
  try {
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 300,       // close room after 5 min if empty
      maxParticipants: 3,      // candidate + agent + egress
      metadata: roomMetadata,
    });
  } catch {
    // Room may already exist — that's fine
  }

  // Issue candidate participant token
  const at = new AccessToken(apiKey, apiSecret, {
    identity: `candidate-${candidateId}`,
    name: candidateName,
    ttl: 7200, // 2 hours
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,        // candidate publishes mic
    canSubscribe: true,      // candidate receives agent audio
    canPublishData: true,    // candidate can send data (future use)
  });

  const token = await at.toJwt();

  // Start Egress recording (audio-only for now — voice migration phase)
  let egressId: string | null = null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseS3Key = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const supabaseS3Secret = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  const supabaseProjectRef = supabaseUrl?.match(/https:\/\/([^.]+)/)?.[1];

  if (supabaseS3Key && supabaseS3Secret && supabaseProjectRef) {
    try {
      const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret);
      const folder = round === 2 ? 'round2' : 'round1';
      const filename = `${folder}/${candidateId}-${Date.now()}-livekit`;

      const egress = await egressClient.startRoomCompositeEgress(roomName, {
        fileOutputs: [{
          filepath: `${filename}.mp4`,
          s3: {
            accessKey: supabaseS3Key,
            secret: supabaseS3Secret,
            bucket: 'interview-recordings',
            endpoint: `https://${supabaseProjectRef}.supabase.co/storage/v1/s3`,
            region: 'us-east-1',  // Supabase S3 uses this
          },
        }],
        audioOnly: true,  // voice-only phase — set false when adding video
        layout: 'speaker',
      });

      egressId = egress.egressId;
      console.log(`[LiveKit] Egress started: ${egressId} for candidate ${candidateId} R${round}`);
    } catch (err) {
      // Egress failure is non-fatal — interview can continue, recording won't be saved
      console.error('[LiveKit] Egress start failed:', err);
    }
  } else {
    console.warn('[LiveKit] Supabase S3 credentials not set — recording disabled');
  }

  return NextResponse.json({
    token,
    serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    roomName,
    egressId,
  });
}
```

**Step 3: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "livekit/token" || echo "No errors in token route"
```

**Step 4: Commit**

```bash
git add frontend/app/api/livekit/
git commit -m "feat: add LiveKit token endpoint with Egress recording"
```

---

## Task 3: Create Stop-Egress Endpoint

**Files:**
- Create: `frontend/app/api/livekit/stop-egress/route.ts`

This gets called by the `end-interview` flow to stop Egress and get the final recording URL.

**Step 1: Create the file**

Create `frontend/app/api/livekit/stop-egress/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { EgressClient } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { egressId, candidateId, round } = await req.json();

  if (!egressId) {
    return NextResponse.json({ success: false, error: 'No egressId' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const livekitUrl = process.env.LIVEKIT_URL!;

  try {
    const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret);
    const egress = await egressClient.stopEgress(egressId);

    // The recording URL in Supabase Storage — Egress writes directly there
    // URL format: https://<project>.supabase.co/storage/v1/object/public/interview-recordings/<path>
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build the public URL from the Egress file path
    const fileOutput = egress.fileResults?.[0];
    if (fileOutput?.filename && candidateId && round) {
      const videoColumn = round === 2 ? 'round_2_video_url' : 'video_url';
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/interview-recordings/${fileOutput.filename}`;

      await supabase
        .from('candidates')
        .update({ [videoColumn]: publicUrl })
        .eq('id', candidateId);

      console.log(`[LiveKit] Egress stopped — recording at ${publicUrl}`);
      return NextResponse.json({ success: true, url: publicUrl });
    }

    return NextResponse.json({ success: true, url: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[LiveKit] Stop egress failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "stop-egress" || echo "No errors"
```

**Step 3: Commit**

```bash
git add frontend/app/api/livekit/stop-egress/
git commit -m "feat: add stop-egress endpoint to finalize recording"
```

---

## Task 4: Install Backend (Python) LiveKit Dependencies

**Files:**
- Modify: `requirements.txt`

**Step 1: Add LiveKit packages to requirements.txt**

Append to `requirements.txt`:

```
# LiveKit Agent
livekit-agents[deepgram,google,silero,turn]>=0.12.0
livekit-api>=0.7.0
```

The `[deepgram,google,silero,turn]` extras install all needed plugins in one line.

**Step 2: Verify the packages install**

```bash
pip install "livekit-agents[deepgram,google,silero,turn]>=0.12.0" livekit-api --dry-run 2>&1 | tail -3
```
Expected: no errors, lists packages to install.

**Step 3: Commit**

```bash
git add requirements.txt
git commit -m "feat: add livekit-agents and plugins to backend requirements"
```

---

## Task 5: Create LiveKit Interview Agent

**Files:**
- Create: `backend/agent.py`

This is the core piece. The agent:
1. Gets dispatched when a candidate joins a room
2. Reads room metadata (candidateName, jobDescription, resumeText, round, dossier)
3. Builds the system prompt (Serena for R1, Nova for R2)
4. Runs VoicePipelineAgent: Deepgram STT → Gemini LLM → Deepgram TTS
5. Forwards transcript entries to frontend via data messages
6. Detects `[END_INTERVIEW]` in LLM output → sends end signal + disconnects
7. Tracks elapsed time and injects time context into each LLM call

**Step 1: Create backend/agent.py**

```python
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
```

**Step 2: Run a syntax check**

```bash
python3 -c "import ast; ast.parse(open('backend/agent.py').read()); print('Syntax OK')"
```
Expected: `Syntax OK`

**Step 3: Verify imports resolve (with packages installed)**

```bash
cd backend && python3 -c "from livekit.agents import cli, llm; print('Imports OK')"
```
Expected: `Imports OK`

**Step 4: Commit**

```bash
git add backend/agent.py
git commit -m "feat: add LiveKit interview agent with Deepgram STT, Gemini LLM, Deepgram TTS"
```

---

## Task 6: Rewrite VoiceAvatar.tsx

**Files:**
- Modify: `frontend/components/VoiceAvatar.tsx`

**What stays the same:**
- All props (candidateId, candidateName, jobTitle, jobDescription, resumeText, round, dossier)
- All UI: permission screen, interview screen, timer, transcript display, status indicator, end button
- The call to `/api/end-interview` or `/api/end-interview-round2` at interview end
- The conversation history format sent to the scoring endpoint

**What changes:**
- Replaces IndexedDB helpers, Deepgram WebSocket, Gemini API calls, MediaRecorder, chunk upload
- Adds LiveKit room connection via `livekit-client`
- Receives transcript from agent data messages instead of building it locally

**Step 1: Replace the full VoiceAvatar.tsx**

The key structural change: the component now gets a LiveKit token, connects to a room, listens for data messages, and delegates all STT/LLM/TTS to the agent. The UI render section is kept exactly as-is.

Replace `frontend/components/VoiceAvatar.tsx` with:

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent, DataPacket_Kind, ConnectionState } from 'livekit-client';
import { Mic, CameraOff, Loader2, Volume2, AlertCircle, Clock, Monitor, X } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConversationEntry {
  role: 'interviewer' | 'candidate';
  speaker: string;
  text: string;
  timestamp: Date;
}

interface VoiceAvatarProps {
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  round?: number;
  dossier?: string[];
}

type InterviewPhase =
  | 'permission'      // requesting mic access
  | 'connecting'      // joining LiveKit room
  | 'active'          // interview in progress
  | 'ending'          // END_INTERVIEW received, submitting scores
  | 'completed';      // all done

// ── Component ─────────────────────────────────────────────────────────────────

export default function VoiceAvatar({
  candidateId,
  candidateName,
  jobTitle,
  jobDescription,
  resumeText,
  round = 1,
  dossier,
}: VoiceAvatarProps) {

  const interviewerName = round === 2 ? 'Nova' : 'Serena';

  // State
  const [phase, setPhase] = useState<InterviewPhase>('permission');
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // Refs
  const roomRef = useRef<Room | null>(null);
  const egressIdRef = useRef<string | null>(null);
  const interviewStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const conversationRef = useRef<ConversationEntry[]>([]);
  const endingRef = useRef(false);  // prevent double-end

  // Keep conversationRef in sync for use in callbacks
  conversationRef.current = conversation;

  // ── Timer ──────────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    interviewStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - interviewStartRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── End interview ──────────────────────────────────────────────────────────

  const endInterview = useCallback(async (finalConversation?: ConversationEntry[]) => {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase('ending');
    stopTimer();

    const transcriptToSubmit = finalConversation || conversationRef.current;

    // Stop Egress recording and get video URL
    if (egressIdRef.current) {
      try {
        await fetch('/api/livekit/stop-egress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            egressId: egressIdRef.current,
            candidateId,
            round,
          }),
        });
      } catch (err) {
        console.error('[VoiceAvatar] Stop egress failed:', err);
      }
    }

    // Disconnect from room
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Submit transcript for scoring (same API as before — unchanged)
    const endpoint = round === 2 ? '/api/end-interview-round2' : '/api/end-interview';
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          conversation: transcriptToSubmit.map(e => ({
            role: e.role,
            speaker: e.speaker,
            text: e.text,
          })),
        }),
      });
    } catch (err) {
      console.error('[VoiceAvatar] End interview API failed:', err);
    }

    setPhase('completed');
  }, [candidateId, round, stopTimer]);

  // ── Connect to LiveKit room ────────────────────────────────────────────────

  const connectToRoom = useCallback(async () => {
    setPhase('connecting');

    try {
      // Get a LiveKit token from our server
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          round,
          candidateName,
          jobTitle,
          jobDescription,
          resumeText,
          dossier,
        }),
      });

      if (!tokenRes.ok) throw new Error('Failed to get LiveKit token');
      const { token, serverUrl, egressId } = await tokenRes.json();

      egressIdRef.current = egressId;

      // Create and connect LiveKit room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      roomRef.current = room;

      // Connection state tracking
      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setConnectionState(state);
        if (state === ConnectionState.Connected) {
          setPhase('active');
          startTimer();
        } else if (state === ConnectionState.Disconnected) {
          if (!endingRef.current) {
            setError('Connection lost. Please refresh to reconnect.');
          }
        }
      });

      // Data messages from agent
      room.on(RoomEvent.DataReceived, (data: Uint8Array) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(data));

          if (msg.type === 'transcript' && msg.entry) {
            const entry: ConversationEntry = {
              ...msg.entry,
              timestamp: new Date(),
            };
            setConversation(prev => [...prev, entry]);
          } else if (msg.type === 'end_interview') {
            // Agent signalled end — use the transcript it sends
            const agentTranscript: ConversationEntry[] = (msg.transcript || []).map(
              (e: Omit<ConversationEntry, 'timestamp'>) => ({ ...e, timestamp: new Date() })
            );
            endInterview(agentTranscript.length > 0 ? agentTranscript : undefined);
          }
        } catch {
          // Ignore malformed data messages
        }
      });

      // Track when agent is speaking (their audio track becomes active)
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const agentIsSpeaking = speakers.some(p => p.identity.startsWith('agent'));
        setIsAgentSpeaking(agentIsSpeaking);
      });

      // Connect to room and publish microphone
      await room.connect(serverUrl, token);
      await room.localParticipant.setMicrophoneEnabled(true);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      console.error('[VoiceAvatar] Connect error:', err);
      setError(`Could not connect to interview: ${message}`);
      setPhase('permission');
    }
  }, [candidateId, round, candidateName, jobTitle, jobDescription, resumeText, dossier, endInterview, startTimer]);

  // ── Request mic permission ─────────────────────────────────────────────────

  const requestPermission = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicError(null);
      await connectToRoom();
    } catch {
      setMicError('Microphone access is required. Please allow access and try again.');
    }
  }, [connectToRoom]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopTimer();
      roomRef.current?.disconnect();
    };
  }, [stopTimer]);

  // ── Format timer ───────────────────────────────────────────────────────────

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── UI Render ──────────────────────────────────────────────────────────────
  // NOTE: UI below is preserved exactly from the original — only infrastructure changed above.

  // Permission screen
  if (phase === 'permission') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mic className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Ready to begin your interview?
          </h1>
          <p className="text-muted-foreground mb-2">
            You&apos;ll be speaking with <strong>{interviewerName}</strong>, your AI interviewer for{' '}
            <strong>{jobTitle}</strong>.
          </p>
          <p className="text-muted-foreground mb-8 text-sm">
            Microphone access is required. Your interview will be recorded.
          </p>
          {micError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {micError}
            </div>
          )}
          <button
            onClick={requestPermission}
            className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  // Connecting screen
  if (phase === 'connecting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-foreground text-lg">Connecting to your interview...</p>
          <p className="text-muted-foreground text-sm mt-2">Setting up secure voice connection</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Connection Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => { setError(null); setPhase('permission'); endingRef.current = false; }}
            className="px-6 py-3 bg-card hover:bg-muted text-foreground rounded-lg transition-colors border border-border"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Ending/submitting screen
  if (phase === 'ending') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-foreground text-lg">Submitting your interview...</p>
        </div>
      </div>
    );
  }

  // Completed screen
  if (phase === 'completed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="rounded-2xl p-10 max-w-md mx-auto text-center border border-border bg-card shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Volume2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Interview Complete
          </h1>
          <p className="text-muted-foreground mb-2">
            Thank you, {candidateName}.
          </p>
          <p className="text-muted-foreground/70 text-sm">
            Your responses have been submitted. We&apos;ll be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  // Active interview screen
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${
            connectionState === ConnectionState.Connected
              ? 'bg-emerald-500 animate-pulse'
              : 'bg-yellow-500'
          }`} />
          <span className="text-sm text-muted-foreground">
            {connectionState === ConnectionState.Connected
              ? `Connected — ${interviewerName} is interviewing you`
              : 'Reconnecting...'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm">{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Conversation panel */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
          {conversation.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {isAgentSpeaking ? `${interviewerName} is speaking...` : 'Waiting for the interview to begin...'}
            </div>
          )}
          {conversation.map((entry, i) => (
            <div
              key={i}
              className={`flex gap-3 ${entry.role === 'candidate' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-muted text-muted-foreground">
                {entry.speaker[0]}
              </div>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                  entry.role === 'candidate'
                    ? 'bg-emerald-600/20 text-foreground ml-auto'
                    : 'bg-card text-foreground border border-border'
                }`}
              >
                <p className="text-xs text-muted-foreground mb-1">{entry.speaker}</p>
                <p>{entry.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Status sidebar */}
        <div className="w-56 flex flex-col gap-4 shrink-0">
          {/* Agent speaking indicator */}
          <div className={`rounded-xl p-4 border transition-colors ${
            isAgentSpeaking
              ? 'border-emerald-500/50 bg-emerald-500/10'
              : 'border-border bg-card'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className={`w-4 h-4 ${isAgentSpeaking ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              <span className="text-sm font-medium">{interviewerName}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAgentSpeaking ? 'Speaking...' : 'Listening'}
            </p>
          </div>

          {/* Mic status */}
          <div className="rounded-xl p-4 border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium">Your mic</span>
            </div>
            <p className="text-xs text-muted-foreground">Active — speak clearly</p>
          </div>

          {/* End button */}
          <button
            onClick={() => endInterview()}
            className="mt-auto flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
          >
            <X className="w-4 h-4" />
            End Interview
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors. If there are import errors for `livekit-client`, ensure `npm install` ran in Task 1.

**Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: Successful build.

**Step 4: Commit**

```bash
git add frontend/components/VoiceAvatar.tsx
git commit -m "feat: rewrite VoiceAvatar to use LiveKit rooms — same UI, replaces WebSocket/recording plumbing"
```

---

## Task 7: Remove Replaced Files

**Files to delete:**
- `frontend/app/api/chat/route.ts`
- `frontend/app/api/deepgram/route.ts`
- `frontend/app/api/deepgram-tts/route.ts`
- `frontend/app/api/finalize-recording/route.ts`
- `frontend/app/api/save-recording-chunk/route.ts`
- `backend/video_fixer.py`

**Step 1: Delete the API routes**

```bash
rm -rf frontend/app/api/chat
rm -rf frontend/app/api/deepgram
rm -rf frontend/app/api/deepgram-tts
rm -rf frontend/app/api/finalize-recording
rm -rf frontend/app/api/save-recording-chunk
```

**Step 2: Delete the video fixer**

```bash
rm backend/video_fixer.py
```

**Step 3: Build to confirm no broken imports**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: Clean build. No "cannot find module" errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove replaced files — chat, deepgram, finalize-recording, video_fixer"
```

---

## Task 8: Update listener.py — Remove Video Fixer Step

**Files:**
- Modify: `backend/listener.py`

**Step 1: Remove video_fixer import and Step 4**

In `backend/listener.py`:

Remove this line at the top:
```python
from video_fixer import run_video_fixer
```

Remove this block from `run_pipeline_cycle()`:
```python
    # Step 4: Remux interview recordings for seekable downloads
    try:
        fixed = run_video_fixer()
        log("INFO", f"Step 4 (VideoFixer): {fixed} recording(s) remuxed")
    except Exception as e:
        log("ERROR", f"Step 4 (VideoFixer) failed: {e}")
```

**Step 2: Verify syntax**

```bash
python3 -c "import ast; ast.parse(open('backend/listener.py').read()); print('Syntax OK')"
```

**Step 3: Commit**

```bash
git add backend/listener.py
git commit -m "chore: remove video_fixer step from pipeline — Egress handles recordings"
```

---

## Task 9: Railway Deployment — LiveKit Agent Service

The agent runs as a **separate Railway service** from `listener.py`.

**Step 1: Create agent entry point**

Create `backend/start_agent.sh`:

```bash
#!/bin/bash
# Entry point for LiveKit Agent Railway service
cd /app/backend
python agent.py dev
```

Or more simply, configure Railway to run: `cd backend && python agent.py dev`

**Step 2: Create Railway service for the agent**

In Railway dashboard:
1. Add new service → point to same GitHub repo
2. Set root directory: (repo root)
3. Set start command: `pip install -r requirements.txt && cd backend && python agent.py start`
4. Add environment variables:
   - `LIVEKIT_URL=wss://your-livekit-host`
   - `LIVEKIT_API_KEY=your-key`
   - `LIVEKIT_API_SECRET=your-secret`
   - `DEEPGRAM_API_KEY=...`
   - `GEMINI_API_KEY=...`
   - `SUPABASE_URL=...`
   - `SUPABASE_KEY=...`

**Step 3: LiveKit Server — recommended option**

**Option A (Recommended): LiveKit Cloud**
- Sign up at livekit.io/cloud — generous free tier (50 participants)
- Get URL, API key, API secret from dashboard
- No infrastructure to manage
- Set these in both frontend and agent env vars

**Option B: Self-hosted on Railway**
- Add Railway service with Docker image: `livekit/livekit-server`
- Set env var: `LIVEKIT_KEYS=yourapikey:yourapisecret`
- Set env var: `LIVEKIT_CONFIG` (base64 encoded YAML):
  ```yaml
  port: 7880
  rtc:
    use_external_ip: true
    tcp_port: 7881
  turn:
    enabled: true
    tls_port: 5349
    credential: yourturnpassword
  ```
- WebRTC requires either UDP ports (Railway may not support) or TURN over TCP
- For TURN to work, Railway must expose port 5349 on a public domain
- Note: This is more complex — LiveKit Cloud avoids all of this

**Step 4: Supabase S3 credentials for Egress**

In Supabase dashboard:
1. Settings → Storage → S3 Access
2. Generate access key pair
3. Add to frontend env vars:
   - `SUPABASE_S3_ACCESS_KEY_ID=...`
   - `SUPABASE_S3_SECRET_ACCESS_KEY=...`

**Step 5: Commit deployment docs**

```bash
git add backend/start_agent.sh
git commit -m "feat: add agent start script and deployment configuration"
```

---

## Task 10: End-to-End Testing

**Prerequisites:**
- LiveKit server running (Cloud or Railway)
- Agent service deployed and running (`python agent.py start` or `dev` for local)
- Frontend env vars set with LiveKit credentials
- Supabase S3 credentials set for Egress

### Local Testing Checklist

**Step 1: Start agent locally**

```bash
cd backend
LIVEKIT_URL=wss://your-livekit LIVEKIT_API_KEY=key LIVEKIT_API_SECRET=secret \
DEEPGRAM_API_KEY=... GEMINI_API_KEY=... \
python agent.py dev
```
Expected: Agent starts and logs "Waiting for job..."

**Step 2: Start frontend locally**

```bash
cd frontend && npm run dev
```

**Step 3: Open interview URL**

Navigate to `http://localhost:3000/interview/[valid-token]`

**Verification checklist:**

| Test | Expected |
|------|----------|
| Permission screen loads | See "Start Interview" button |
| Click Start Interview | Browser asks for mic permission |
| Allow mic | Phase transitions to 'connecting' |
| Connecting phase | "Connecting to your interview..." spinner |
| Agent joins room | Phase transitions to 'active', connection indicator green |
| Agent speaks opening greeting | Heard in browser, transcript entry appears |
| Candidate speaks | STT transcribes, transcript entry appears with candidate's text |
| Agent responds | Agent speaks response, transcript updates |
| Interviewer speaking indicator | Status sidebar shows "Speaking..." when agent active |
| [END_INTERVIEW] in agent output | Frontend transitions to 'ending' phase |
| Ending phase | Calls /api/end-interview, score saved to DB |
| Completed phase | "Interview Complete" screen shown |

**Step 4: Check recording in Supabase Storage**

After interview ends, in Supabase dashboard → Storage → interview-recordings → verify file exists in `round1/` folder.

**Step 5: Test Round 2**

Navigate to `http://localhost:3000/round2/[valid-r2-token]` and repeat checklist with Nova persona.

**Step 6: Test reconnection**

During active interview, disconnect network for 5 seconds then reconnect.
Expected: LiveKit reconnects automatically, interview continues (agent stays in room).

**Step 7: Test connection drop recovery**

During active interview, close and reopen the browser tab.
Expected: Can reconnect (room still active if within `emptyTimeout`).

---

## Summary: Files Changed

| File | Action |
|------|--------|
| `frontend/package.json` | Add livekit-client, livekit-server-sdk |
| `frontend/app/api/livekit/token/route.ts` | CREATE |
| `frontend/app/api/livekit/stop-egress/route.ts` | CREATE |
| `frontend/components/VoiceAvatar.tsx` | REWRITE (same UI, new infrastructure) |
| `frontend/app/api/chat/` | DELETE |
| `frontend/app/api/deepgram/` | DELETE |
| `frontend/app/api/deepgram-tts/` | DELETE |
| `frontend/app/api/finalize-recording/` | DELETE |
| `frontend/app/api/save-recording-chunk/` | DELETE |
| `backend/agent.py` | CREATE |
| `backend/video_fixer.py` | DELETE |
| `backend/listener.py` | Remove video_fixer import + Step 4 |
| `requirements.txt` | Add livekit-agents packages |
