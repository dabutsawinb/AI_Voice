# ─────────────────────────────────────────────────────────
# AI Voice Studio — Backend Dockerfile
# Base: CUDA 12.1 + Python 3.10
# ─────────────────────────────────────────────────────────

FROM pytorch/pytorch:2.2.1-cuda12.1-cudnn8-runtime

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir \
        torch torchaudio \
        --index-url https://download.pytorch.org/whl/cu121

# Create directories
RUN mkdir -p models_store/rvc models_store/tts outputs ai-engines

# Copy source
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
