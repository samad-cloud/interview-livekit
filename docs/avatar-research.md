# Avatar Integration Research — AI Voice Interview Platform

**Date**: 2026-03-03
**Goal**: Add visual avatar to voice interviews to improve candidate engagement.
**Constraint**: Free (preferred) or < $1 per interview. Must integrate with existing Next.js + Deepgram TTS + Gemini stack.

---

## The Problem

Voice-only interviews lack visual engagement. HeyGen was evaluated but is too expensive at scale. Need a free or near-free avatar that can lip-sync to Deepgram Aura TTS audio in real time.

---

## Option 1 — TalkingHead 3D + Ready Player Me + wawa-lipsync
**Cost: $0 (completely free, runs entirely in browser)**

### What it is
- **[TalkingHead (3D)](https://github.com/met4citizen/TalkingHead)** — open-source JS class by met4citizen. Renders full-body 3D avatars with real-time lip sync via Three.js/WebGL in the browser. Featured at CHI 2025 (MIT Media Lab / Harvard research).
- **[Ready Player Me](https://readyplayer.me)** — free 3D avatar creator. Outputs GLB format with all Oculus OVR viseme blend shapes included. Free for developers.
- **[wawa-lipsync](https://github.com/wass08/wawa-lipsync)** — free npm package. Listens to any audio source and outputs viseme data in real-time using Web Audio API. No server required.

### Why it fits the stack perfectly
Deepgram Aura TTS outputs `linear16` PCM at configurable sample rates (including 16000 Hz).
TalkingHead's `speakAudio()` method **accepts PCM 16-bit LE audio chunks directly** — an exact format match.
You pipe Deepgram TTS output straight into the avatar with zero conversion.

wawa-lipsync can also drive visemes from any playing audio source, so it hooks into the existing TTS playback path.

### Audio pipeline
```
Deepgram STT (existing) → Gemini (existing) → Deepgram TTS (existing)
                                                        ↓
                                              PCM chunks → speakAudio()
                                                        ↓
                                         TalkingHead 3D (Three.js in browser)
                                         ← wawa-lipsync drives visemes from audio
```

### Integration work required
- Add `three`, `@readyplayerme/visage`, `wawa-lipsync` to `package.json`
- Create `AvatarPlayer.tsx` wrapping TalkingHead inside a Three.js canvas
- Slot into `components/VoiceAvatar.tsx` — route TTS audio buffer through `speakAudio()` instead of (or alongside) the existing `<audio>` element
- Create Wayne and Atlas avatars as Ready Player Me GLBs (free, hosted by RPM CDN)

### Pros
- Zero cost, forever
- 100% client-side — no new backend, no API key, no usage limits
- Full body + facial expressions (emojis → blendshapes built in)
- Proven in academic AI interview research (CHI 2025)
- `speakAudio()` PCM passthrough = minimal code change to existing TTS path

### Cons
- 3D cartoon/stylized look — not photorealistic
- Requires Three.js in a Next.js component (moderate complexity)
- Ready Player Me avatars have a "game-like" aesthetic — professional but not human

---

## Option 2 — Simli AI (Trinity-1 Model)
**Cost: < $0.01/minute → < $0.30 for a 30-minute interview**

### What it is
[Simli](https://simli.com) is a speech-to-video avatar API designed specifically for real-time AI agents. Their **Trinity-1** model (announced July 2025, based on Gaussian splatting) is priced at **less than 1 cent per minute**, explicitly built for interview and customer-service use cases.

> *"Trinity-1 unlocks interactive AI to millions of users at less than 1 cent per minute, while market rates exceed 5–20 cents per minute."*

### Pricing
| Model | Cost/min | 30-min interview | Free allowance |
|---|---|---|---|
| **Trinity-1** | **< $0.01** | **< $0.30** | 50 min/month + $10 at signup |
| Standard avatars | $0.05 | $1.50 | same |

**Use Trinity-1.** Standard avatars exceed the $1/interview budget for 30-minute sessions.

### Why it fits the stack perfectly
Simli WebRTC API requires: **PCM Int16, 16000 Hz, mono** — identical to Deepgram's `linear16` TTS output at 16kHz. Stream Deepgram TTS bytes directly to Simli's WebSocket with zero conversion.

```
Deepgram TTS → PCM Int16 @ 16kHz → Simli WebSocket → WebRTC video stream in browser
```

### Integration work required
- `npm install simli-client`
- `startSession(faceId, apiKey)` → get back WebRTC `<video>` element
- In existing TTS callback: `ws.send(uint8Array)` to stream audio chunks
- Drop `<video>` element into the interview UI

### Pros
- Photorealistic human face — most interview-appropriate
- WebRTC-native: ultra-low latency, browser renders, no GPU on client
- Designed for AI interview bots — Simli's own demo is a mock interview coach
- Minimal integration surface: start session, pipe audio, display video
- 50 free min/month = test with real candidates before paying

### Cons
- Not free — < $0.30/interview is minimal but not zero
- Trinity-1 is in preview (July 2025) — may have occasional rough edges
- Dependent on Simli uptime during live interviews (mitigation: graceful fallback to voice-only)
- Must ensure Deepgram TTS is configured to output 16000 Hz (not 24000 Hz default)

---

## Option 3 — D-ID Streaming API
**Cost: ~$18/month for 32 minutes total**

Not viable at scale. The entry plan caps at 32 streaming minutes/month — less than a single interview session. **Ruled out.**

---

## Option 4 — Tavus CVI (Conversational Video Interface)
**Cost: ~$0.10/minute → ~$3/interview**

Good quality with custom avatar cloning (could clone Wayne/Atlas as real human faces). But 3× over the $1/interview budget. Worth revisiting if budget increases — their model is conceptually the closest to HeyGen at lower cost.

Free tier: 25 minutes total.

---

## Option 5 — Self-Hosted MuseTalk (Tencent, MIT License)
**Cost: Railway GPU compute (~$0.02–0.10/min) + $0 API fees**

[MuseTalk v1.5](https://huggingface.co/kevinwang676/MuseTalk1.5) (March 2025) runs 30fps+ lip sync on NVIDIA GPU. Would run as a WebSocket microservice on Railway: send audio in, get lip-synced video of a static base image back. The base image could be a custom face for Wayne or Atlas.

**Verdict**: Too much operational overhead. Railway GPU instances aren't persistent and cold-start would break live interview flow. Only viable later if a real human face (e.g., Printerpix employee) is needed as the interviewer persona. **Deferred.**

---

## Compatibility Matrix

| Solution | Deepgram TTS compat | Frontend-only | Cost / 30-min | Integration effort |
|---|---|---|---|---|
| **TalkingHead 3D + RPM** | ✅ PCM passthrough | ✅ | **$0** | Medium (Three.js) |
| **Simli Trinity-1** | ✅ PCM Int16 exact match | ✅ WebRTC | **< $0.30** | Low (npm + WebSocket) |
| wawa-lipsync alone | ✅ Any audio source | ✅ | $0 | Low (2D only, no face) |
| Tavus CVI | Needs adapter | ✅ | ~$3 | Medium |
| D-ID Streaming | Needs adapter | ✅ | Caps at 32 min/mo | Low |
| MuseTalk self-hosted | ✅ | ❌ GPU server | ~$0.10 compute | High |

---

## Recommendation

### Phase 1 — Free MVP: TalkingHead 3D + Ready Player Me

Start here. Zero cost, no external dependency, integrates with existing Deepgram TTS via PCM passthrough. Design "Wayne" and "Atlas" as Ready Player Me avatars (free). The main work is a new `AvatarPlayer.tsx` component that wraps TalkingHead and receives audio from the existing TTS flow in `VoiceAvatar.tsx`.

### Phase 2 — Photorealistic fallback: Simli Trinity-1

If the 3D cartoon look doesn't pass the quality bar, switch to Simli Trinity-1. The cost is < $0.30/interview, the integration is nearly identical (swap audio destination from TalkingHead to Simli WebSocket), and the result is a real human face. The 50 free minutes/month allows a proper A/B test before any spend.

---

## Sources

- [TalkingHead (3D) GitHub](https://github.com/met4citizen/TalkingHead)
- [HeadTTS (in-browser neural TTS for TalkingHead)](https://github.com/met4citizen/HeadTTS)
- [wawa-lipsync GitHub](https://github.com/wass08/wawa-lipsync)
- [Wawa Sensei real-time lipsync tutorial](https://wawasensei.dev/tuto/real-time-lipsync-web)
- [RPM Visage React component](https://github.com/readyplayerme/visage)
- [RPM Lipsync (Conv-AI)](https://github.com/Conv-AI/RPM-Lipsync)
- [Simli overview docs](https://docs.simli.com/overview)
- [Simli WebRTC API reference](https://docs.simli.com/api-reference/simli-webrtc)
- [Simli Trinity-1 announcement](https://x.com/simli_ai/status/1943399617380651455)
- [Simli React SDK (archived)](https://github.com/simliai/Simli-React-SDK)
- [Deepgram TTS encoding docs](https://developers.deepgram.com/docs/tts-encoding)
- [Deepgram TTS sample rate docs](https://developers.deepgram.com/docs/tts-sample-rate)
- [MuseTalk v1.5 on HuggingFace](https://huggingface.co/kevinwang676/MuseTalk1.5)
- [Tavus pricing](https://www.tavus.io/pricing)
- [HeyGen alternatives comparison](https://www.eesel.ai/blog/heygen-alternatives)
- [D-ID API pricing](https://www.d-id.com/pricing/api/)
