# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Voice-Only AI Recruiter — an end-to-end AI-powered recruiting platform for Printerpix. Candidates apply via email, get auto-screened by AI (Gemini), and complete voice interviews with two AI interviewers (Wayne for personality, Atlas for technical) using Deepgram for speech and Gemini for conversation.

## Commands

### Frontend (Next.js — in `frontend/`)
```bash
cd frontend && npm install       # Install dependencies
cd frontend && npm run dev       # Dev server at http://localhost:3000
cd frontend && npm run build     # Production build
cd frontend && npm run lint      # ESLint
```

### Backend (Python — in `backend/`)
```bash
pip install -r requirements.txt          # Install dependencies (from repo root)
cd backend && python listener.py         # Run main pipeline (loops every 60s)
cd backend && python grader.py           # Run grader only
cd backend && python mailer.py           # Run mailer only
python read/ingest.py                    # Run email ingestion only
cd backend && python utils.py            # Generate Gmail OAuth token
```

### Database Migrations
```bash
# Migrations in migrations/ — run via Supabase MCP (execute_sql tool)
# After creating a migration file, execute it directly using the Supabase MCP server
```

### Deployment
- **Frontend**: Vercel, root directory set to `frontend/`
- **Backend**: Railway (`railway.json`) — NIXPACKS builder, restart on failure, runs `cd backend && python listener.py`

## Architecture

Two independently deployed services sharing a Supabase PostgreSQL database.

### Frontend (Vercel) — Next.js 16 / React 19 / TypeScript / Tailwind CSS 4

**UI Stack**: shadcn/ui (New York style), Lucide icons, dark mode enabled globally. Components in `components/ui/`, utility in `lib/utils.ts`. Config in `components.json`.

**Pages**:
| Route | Auth | Purpose |
|-------|------|---------|
| `/dashboard` | Protected | HR management — candidate list, scoring, invites |
| `/gen-job` | Protected | AI job description generator |
| `/screener` | Protected | CV bulk screening |
| `/interview/[token]` | Public | Round 1 voice interview (Wayne) |
| `/round2/[token]` | Public | Round 2 technical interview (Atlas) |
| `/login` | Public | Email/password auth via Supabase |

**Auth**: Middleware (`middleware.ts`) protects `/dashboard`, `/screener`, `/gen-job` via Supabase SSR cookies. Redirects to `/login?redirect=[pathname]`.

**API Routes** (`app/api/`):
- `chat/` — Gemini chat proxy. Payload: `{ message, systemPrompt, history[] }`. Uses direct Google SDK (`gemini-2.0-flash`), NOT the AI Gateway.
- `deepgram/` — Returns STT API key
- `deepgram-tts/` — Returns TTS API key
- `end-interview/` — Finalizes Round 1, scores transcript, stores result
- `end-interview-round2/` — Finalizes Round 2
- `tally-webhook/` — Receives Tally form submissions for Dubai visa eligibility. Updates candidate status (`FORM_COMPLETED` or `REJECTED_VISA`) and stores responses in `questionnaire_responses` JSONB column. Validated via `TALLY_WEBHOOK_SECRET` header.

**Server Actions** (`app/actions/`) — All use `'use server'` directive:
- `generateJob.ts` — Job description via `generateText()`
- `generateQuestions.ts` — Structured question generation via `generateObject()` + Zod schema
- `generateDossier.ts` — Round 1 transcript analysis → Round 2 probe questions via `generateObject()` + Zod
- `generateFinalVerdict.ts` — Hiring verdict via `generateObject()` + Zod schema
- `sendInvite.ts` — Gmail OAuth2 email dispatch. Calls `generateDossier()` before Round 2 invite.
- `bulkScreen.ts` — Batch CV screening

**Key component**: `components/VoiceAvatar.tsx` (~820 LOC) — Main interview UI handling Deepgram WebSocket STT, Gemini chat, and TTS playback. Conversation history maintained in React refs.

### AI SDK Configuration

**Two separate AI integrations exist — do not confuse them:**

1. **Vercel AI Gateway** (`lib/ai.ts`) — Used by server actions
   - `gemini` → `google/gemini-2.5-flash` (fast, simple tasks)
   - `geminiPro` → `google/gemini-3-pro-preview` (complex reasoning)
   - Requires `AI_GATEWAY_API_KEY`
   - Uses `generateText()` and `generateObject()` from `ai` package

2. **Direct Google SDK** (`app/api/chat/route.ts`) — Used by real-time interview chat
   - Uses `@google/generative-ai` directly for streaming responses
   - Requires `GEMINI_API_KEY`
   - Necessary for low-latency voice interview loop (agents/tool loops add too much latency)

**Pattern**: Use AI Gateway for background/async tasks (scoring, dossier, questions). Use direct SDK for real-time voice streaming where latency matters.

### Backend (Railway) — Python 3.11+

- **`listener.py`**: Main orchestrator — continuous 60-second loop calling pipeline stages: ingest → grade → mail.
- **`read/ingest.py`**: Gmail "Applications" label → resume extraction (PDF/DOCX) → Gemini parsing → Supabase
- **`grader.py`**: Scores candidates against job descriptions (Gemini JSON mode, score ≥ 70 passes)
- **`mailer.py`**: Sends Tally eligibility form (HTML email with CTA) for Dubai roles, or direct interview invite for others
- **`utils.py`**: Shared Gmail OAuth2, Gemini client, Supabase client initialization

### Pipeline Flow
```
Email → ingest.py (parse resume) → grader.py (score ≥70?) → mailer.py
  ├─ Non-Dubai → direct interview invite → /interview/[token]
  └─ Dubai → HTML email with Tally CTA → Tally.so form
       ├─ Valid visa → redirect to /interview/[token] + webhook → FORM_COMPLETED
       └─ Invalid visa → Tally rejection page + webhook → REJECTED_VISA

/interview/[token] (Wayne: personality) → /api/end-interview (score + transcript)
  → HR dashboard review → inviteToRound2() triggers generateDossier()
  → /round2/[token] (Atlas: technical, uses probe questions from dossier)
  → /api/end-interview-round2 → generateFinalVerdict() → HR final review
```

### Candidate Status Progression
- **Non-Dubai**: `NEW_APPLICATION` → `GRADED` (or `CV_REJECTED`) → `INVITE_SENT` → `INTERVIEW_STARTED` → `COMPLETED`
- **Dubai**: `NEW_APPLICATION` → `GRADED` → `QUESTIONNAIRE_SENT` → `FORM_COMPLETED` (or `REJECTED_VISA`) → `INTERVIEW_STARTED` → `COMPLETED`

### Database (Supabase)

Two tables: `jobs` and `candidates`. The `candidates` table tracks all state — scores, transcripts, tokens, status, metadata JSONB, `round_1_dossier` (probe questions array), `round_1_full_dossier` (structured analysis). The `interview_token` UUID field generates secure interview links. Pending migration in `migrations/001_enhance_jobs_table.sql` adds 30+ fields to jobs (salary ranges, visa sponsorship, skills arrays, etc).

### Supabase Client Architecture
- `lib/supabase-browser.ts` — `createBrowserClient` (SSR-safe, for client components)
- `lib/supabaseClient.ts` — Direct `createClient` (simpler, for quick operations)
- `lib/supabase-server.ts` — Server-side client (for middleware/server actions)

## Environment Variables

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase connection
- `DEEPGRAM_API_KEY` — Speech-to-text and TTS
- `GEMINI_API_KEY` — Direct Google SDK (real-time chat routes)
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway (server actions)
- `TALLY_WEBHOOK_SECRET` — Shared secret for validating Tally webhook requests

### Backend (`backend/.env`)
- `SUPABASE_URL`, `SUPABASE_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_CREDENTIALS_JSON` (full credentials.json as string)
- `GOOGLE_TOKEN_JSON` (full token.json as string)
- `TALLY_FORM_ID` — Tally.so form ID for Dubai visa eligibility questionnaire

## Key Patterns

- **Dual AI SDK approach**: Vercel AI Gateway (`lib/ai.ts`) for async server actions with structured outputs. Direct Google SDK for real-time voice interview chat where latency is critical.
- **Structured AI outputs**: Server actions use `generateObject()` with Zod schemas for type-safe responses (questions, dossiers, verdicts). Schemas are defined inline in each action file.
- **Gemini JSON mode (backend)**: Used in grader.py and ingest.py with regex fallback parsing when JSON response is malformed.
- **Gmail OAuth2**: Production reads credentials from env vars (JSON strings); local dev uses files. Token refresh is automatic.
- **Voice interview pipeline**: Deepgram WebSocket for real-time STT → Gemini chat API with system prompts defining interviewer personality → Deepgram Aura TTS for spoken responses.
- **Interview security**: UUID tokens for links, status-gated retake prevention, `created_at` field prevents emailing legacy candidates.
- **Dossier pipeline**: When HR invites to Round 2, `sendInvite.ts` auto-calls `generateDossier()` which analyzes Round 1 transcript and generates probe questions. Atlas reads these from `round_1_dossier` column.
- **Database migration rule**: When adding code that references new columns, tables, or schema changes, ALWAYS create a numbered migration file in `migrations/` (e.g., `002_description.sql`) and then execute it directly via the Supabase MCP `execute_sql` tool. Never assume schema changes exist without verifying.
