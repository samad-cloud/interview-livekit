FROM python:3.11-slim

WORKDIR /app

# Install FFmpeg for WebM remuxing (adds duration + cues index for seekable downloads)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY read/ ./read/

CMD ["python", "backend/listener.py"]
