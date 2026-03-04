# Railway Environment Variables Reference

## Service 1: LiveKit Server (Docker — livekit/livekit-server)

| Variable | Value |
|----------|-------|
| `LIVEKIT_KEYS` | `APIbb40903e3618250a09cb1081:4d4ddc4dbd5abd37d6b2210dda54b4bef67ecb808b2f97fa9ad92e64112ce8ce` |
| `LIVEKIT_CONFIG` | *(see below — update domain after Railway assigns it)* |

### LIVEKIT_CONFIG (base64) — update domain first, then re-encode:
```yaml
port: 7880
rtc:
  use_external_ip: true
  tcp_port: 7881
turn:
  enabled: true
  domain: REPLACE_WITH_RAILWAY_LIVEKIT_DOMAIN
  tls_port: 5349
  credential: 56c361114b1a46b6655a4c2a36c01f84
```
Encode: `python3 -c "import base64; print(base64.b64encode(open('config.yaml','rb').read()).decode())"`

---

## Service 2: LiveKit Egress (Docker — livekit/egress)

| Variable | Value |
|----------|-------|
| `LIVEKIT_URL` | `wss://REPLACE_WITH_RAILWAY_LIVEKIT_DOMAIN` |
| `LIVEKIT_API_KEY` | `APIbb40903e3618250a09cb1081` |
| `LIVEKIT_API_SECRET` | `4d4ddc4dbd5abd37d6b2210dda54b4bef67ecb808b2f97fa9ad92e64112ce8ce` |

---

## Service 3: LiveKit Agent (existing Railway Python service)

| Variable | Value |
|----------|-------|
| `LIVEKIT_URL` | `wss://REPLACE_WITH_RAILWAY_LIVEKIT_DOMAIN` |
| `LIVEKIT_API_KEY` | `APIbb40903e3618250a09cb1081` |
| `LIVEKIT_API_SECRET` | `4d4ddc4dbd5abd37d6b2210dda54b4bef67ecb808b2f97fa9ad92e64112ce8ce` |
| `DEEPGRAM_API_KEY` | `d1a431cc7385039692341f0d7a9df9aabb0318cd` |
| `GEMINI_API_KEY` | `AIzaSyBo-Nr2HeI3IURYpEGwzccfHCFgjASkAHo` |
| `SUPABASE_URL` | `https://igssougbevxgsilxkgvd.supabase.co` |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnc3NvdWdiZXZ4Z3NpbHhrZ3ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3OTE2OTcsImV4cCI6MjA3NDM2NzY5N30.us1QFKbW2y3ZW6c4iX7HODPHRPJyP8h5N-7JAfP_CMQ` |
| Start command | `pip install -r requirements.txt && cd backend && python agent.py start` |

---

## Vercel Frontend — add these new vars

| Variable | Value |
|----------|-------|
| `LIVEKIT_URL` | `wss://REPLACE_WITH_RAILWAY_LIVEKIT_DOMAIN` |
| `LIVEKIT_API_KEY` | `APIbb40903e3618250a09cb1081` |
| `LIVEKIT_API_SECRET` | `4d4ddc4dbd5abd37d6b2210dda54b4bef67ecb808b2f97fa9ad92e64112ce8ce` |
| `NEXT_PUBLIC_LIVEKIT_URL` | `wss://REPLACE_WITH_RAILWAY_LIVEKIT_DOMAIN` |
| `SUPABASE_S3_ACCESS_KEY_ID` | `fb04f2926366960a7891477cb39e7fe1` |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | `b5ca4d73d1d50476659dab872af2c391c65b3d2c42028149e872d3f88c112ef8` |

---

## Deployment Order

1. Deploy **LiveKit Server** service → get Railway domain → replace all `REPLACE_WITH_RAILWAY_LIVEKIT_DOMAIN`
2. Re-encode LIVEKIT_CONFIG with real domain → update LiveKit Server env var → redeploy
3. Deploy **LiveKit Egress** service with real LIVEKIT_URL
4. Deploy **LiveKit Agent** service with real LIVEKIT_URL
5. Add new vars to **Vercel** frontend → redeploy
