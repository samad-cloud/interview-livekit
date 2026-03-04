#!/bin/bash
# Entry point for LiveKit Agent Railway service
# Railway start command: bash backend/start_agent.sh
cd /app/backend
python agent.py start
