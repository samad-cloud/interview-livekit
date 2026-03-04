# LiveKit Deployment Guide

## Architecture

Two Railway services + LiveKit server:
1. **Recruiter pipeline** (`listener.py`) — existing service, unchanged
2. **LiveKit Agent** (`agent.py`) — NEW service, handles interview conversations
3. **LiveKit Server** — LiveKit Cloud (recommended) or self-hosted on Railway

## Environment Variables

### Frontend (Vercel / `.env.local`)
```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
SUPABASE_S3_ACCESS_KEY_ID=your-s3-key     # from Supabase Settings > Storage > S3 Access
SUPABASE_S3_SECRET_ACCESS_KEY=your-s3-secret
```

### Agent Service (Railway)
```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
DEEPGRAM_API_KEY=...
GEMINI_API_KEY=...
SUPABASE_URL=...
SUPABASE_KEY=...
```

## Railway Agent Service Setup

1. Add new service in Railway dashboard
2. Point to same GitHub repo
3. Set start command: `pip install -r requirements.txt && cd backend && python agent.py start`
4. Add all environment variables listed above
5. Deploy to same region as LiveKit server for lowest latency

## LiveKit Server Options

### Option A: LiveKit Cloud (Recommended)
- Sign up at livekit.io/cloud — free tier: 50 concurrent participants
- Get URL (wss://...), API key, API secret from dashboard
- No infrastructure to manage — handles TURN, ICE, scaling automatically

### Option B: Self-hosted on Railway
- Add Railway service with Docker image: `livekit/livekit-server`
- Set env: `LIVEKIT_KEYS=yourapikey:yourapisecret`
- WebRTC requires TURN over TCP (port 5349) — Railway must expose this port
- More complex — LiveKit Cloud is strongly preferred

## Supabase S3 Credentials for Egress Recording

1. Supabase Dashboard → Settings → Storage → S3 Access
2. Generate access key pair
3. Create bucket `interview-recordings` with public read access
4. Add `SUPABASE_S3_ACCESS_KEY_ID` and `SUPABASE_S3_SECRET_ACCESS_KEY` to frontend env

## End-to-End Testing Checklist

### Pre-flight
- [ ] LiveKit server running (Cloud or self-hosted)
- [ ] Agent service deployed: logs show "Waiting for job..."
- [ ] Frontend env vars set (LIVEKIT_URL, API key/secret, NEXT_PUBLIC_LIVEKIT_URL)
- [ ] Supabase S3 creds set for recording

### Round 1 Interview Test
- [ ] Navigate to `/interview/[valid-token]`
- [ ] Permission screen loads with "Start Interview" button
- [ ] Click button → browser asks for mic permission
- [ ] Allow mic → phase transitions to "connecting" spinner
- [ ] Agent joins room → phase goes "active", status dot turns green
- [ ] Agent speaks opening greeting → transcript entry appears
- [ ] Candidate speaks → STT transcribes, transcript entry appears
- [ ] Agent responds → agent speaking indicator shows "Speaking..."
- [ ] Agent delivers closing script with [END_INTERVIEW] → phase transitions to "ending"
- [ ] After ~3 seconds → "Interview Complete" screen shown
- [ ] Supabase candidates table updated: score + transcript stored
- [ ] Supabase Storage: `interview-recordings/round1/` has recording file

### Round 2 Interview Test
- [ ] Navigate to `/round2/[valid-r2-token]`
- [ ] Repeat above with Nova persona
- [ ] Verify probe questions from dossier are used

### Reconnection Test
- [ ] During active interview, disable network for 5 seconds then re-enable
- [ ] LiveKit reconnects automatically (yellow dot → green dot)
- [ ] Interview continues without interruption

### Connection Drop Recovery
- [ ] During active interview, close and reopen browser tab
- [ ] Can rejoin within emptyTimeout window (5 min)
- [ ] Agent still in room, interview continues
