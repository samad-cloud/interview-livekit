# 🎙️ Voice-Only AI Recruiter

An end-to-end AI-powered recruiting pipeline with **voice-only interviews**. Candidates apply via email, get auto-screened by AI, and complete voice interviews with AI interviewers.

## 🎯 How It Works

```
📧 Applications arrive via email (with resume)
            ↓
🤖 AI parses resume & scores fit (0-100)
            ↓
❌ Score < 70? → Auto-rejected
✅ Score ≥ 70? → Candidate gets interview invite
            ↓
🎤 Voice AI Interview (10-20 mins)
   • Round 1: "Wayne" (Culture/Drive assessment)
   • Round 2: "Atlas" (Technical deep-dive)
            ↓
📊 AI analyzes interview & scores candidate
            ↓
📋 Results appear on HR Dashboard
```

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Backend | Python 3.11+ |
| Database | Supabase (PostgreSQL) |
| AI Brain | Google Gemini 2.0 |
| Speech-to-Text | Deepgram Nova-2 |
| Text-to-Speech | Deepgram Aura |
| Email | Gmail API |
| Hosting | Vercel (frontend) + Railway (backend) |

---

## 📁 Project Structure

```
├── frontend/                 # Next.js app
│   ├── app/
│   │   ├── dashboard/        # HR Dashboard
│   │   ├── interview/[token] # Voice interview page
│   │   ├── round2/[token]    # Round 2 interview
│   │   └── api/              # API routes
│   └── components/
│       └── VoiceAvatar.tsx   # Voice interview UI
│
├── backend/                  # Python pipeline
│   ├── listener.py           # Main orchestrator
│   ├── grader.py             # Resume scoring
│   ├── mailer.py             # Email sender
│   └── utils.py              # Shared utilities
│
└── read/
    └── ingest.py             # Email ingestion
```

---

## 🚀 Complete Setup Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/voice-recruiter.git
cd voice-recruiter
```

---

### Step 2: Set Up Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** → Give it a name → Wait for it to spin up
3. Go to **Settings** → **API** and copy:
   - `Project URL` → This is your `SUPABASE_URL`
   - `anon public` key → This is your `SUPABASE_KEY`

4. Go to **SQL Editor** and run this to create tables:

```sql
-- Jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Candidates table
CREATE TABLE candidates (
  id SERIAL PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  resume_text TEXT,
  job_id UUID REFERENCES jobs(id),
  job_description TEXT,
  jd_match_score INTEGER,
  rating INTEGER,
  round_2_rating INTEGER,
  status TEXT DEFAULT 'NEW_APPLICATION',
  current_stage TEXT,
  interview_token UUID DEFAULT gen_random_uuid(),
  interview_transcript TEXT,
  round_2_transcript TEXT,
  ai_summary TEXT,
  final_verdict TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Step 3: Set Up Deepgram (Speech AI)

1. Go to [deepgram.com](https://deepgram.com) and create a free account
2. You get **$200 free credits** - more than enough for testing
3. Go to **API Keys** → Create new key
4. Copy the key → This is your `DEEPGRAM_API_KEY`

---

### Step 4: Set Up Google Gemini (AI Brain)

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API Key** → **Create API key**
3. Copy the key → This is your `GEMINI_API_KEY`

---

### Step 5: Set Up Gmail API (Email Automation)

This is the most complex part. Follow carefully:

#### 5.1 Create Google Cloud Project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click dropdown at top → **New Project**
3. Name it (e.g., "Voice Recruiter") → **Create**

#### 5.2 Enable Gmail API
1. Go to **APIs & Services** → **Library**
2. Search "Gmail API" → Click it → **Enable**

#### 5.3 Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** → **Create**
3. Fill in:
   - App name: "Voice Recruiter"
   - User support email: your email
   - Developer email: your email
4. Click **Save and Continue** through all steps
5. On **Test users** page → **Add Users** → Add the Gmail you'll use

#### 5.4 Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Desktop app**
4. Name it anything → **Create**
5. Click **Download JSON** → Save as `credentials.json`

#### 5.5 Generate Token
1. Put `credentials.json` in the `backend/` folder
2. Run:
```bash
cd backend
pip install google-auth-oauthlib google-api-python-client
python utils.py
```
3. A browser window opens → Sign in with your Gmail → Allow access
4. This creates `token.json` in the backend folder

#### 5.6 Save Credentials as Environment Variables
For deployment, you need these as environment variables:
- `GOOGLE_CREDENTIALS_JSON` = Contents of `credentials.json` (as one line)
- `GOOGLE_TOKEN_JSON` = Contents of `token.json` (as one line)

---

### Step 6: Set Up Gmail Label & Filter

1. In Gmail, create a label called `Applications`
2. Create a filter:
   - Click the search bar → Click filter icon
   - From: `noreply@betterteam.com` (or wherever your job applications come from)
   - Click **Create filter** → **Apply label: Applications**
   - Check **Also apply to matching conversations**

---

### Step 7: Configure Environment Variables

#### Frontend (`frontend/.env.local`)
Create this file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DEEPGRAM_API_KEY=your_deepgram_api_key
GEMINI_API_KEY=your_gemini_api_key
```

#### Backend (`backend/.env`)
Create this file:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CREDENTIALS_JSON={"client_id":"...paste full credentials.json content..."}
GOOGLE_TOKEN_JSON={"token":"...paste full token.json content..."}
```

---

### Step 8: Run Locally

#### Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000

#### Start Backend
```bash
cd backend
pip install -r ../requirements.txt
python listener.py
```

---

## ☁️ Deploy to Production

### Frontend → Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. Set **Root Directory**: `frontend`
5. Add Environment Variables (same as `.env.local`)
6. **Deploy**

### Backend → Railway

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo**
3. Set **Root Directory**: `backend`
4. Add Environment Variables (same as `.env`)
5. The start command is auto-detected from `railway.json`
6. **Deploy**

---

## 🎤 How the AI Interview Works

### Round 1: Wayne (Talent Scout)
- Assesses culture fit, drive, and ownership
- Looks for "A-players" with hunger and resilience
- Probes for specific examples and numbers

### Round 2: Atlas (Technical Architect)
- Deep technical verification
- Uses questions generated from Round 1 analysis
- Direct, no-BS technical assessment

---

## 📊 Dashboard Features

- View all candidates with scores
- Filter by job role
- See interview transcripts
- Send interview invites
- View AI summaries and verdicts

---

## 🛡️ Notes

- The `created_at` field protects against emailing old candidates
- Interview links use UUIDs (secure, unguessable)
- Completed interviews cannot be retaken

---

## 📝 License

MIT - Use freely.
