#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# AI Voice Studio — One-click Setup Script (Linux/macOS + GPU)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${BLUE}[Setup]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[Warn]${NC} $*"; }
err()  { echo -e "${RED}[Error]${NC} $*"; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log "AI Voice Studio Setup"
log "Root: $ROOT"

# ── 1. Copy .env ──
if [ ! -f ".env" ]; then
  cp .env.example .env
  ok "Created .env from .env.example"
else
  warn ".env already exists — skipping"
fi

# ── 2. Create directories ──
mkdir -p ai-engines backend/models_store/rvc backend/models_store/tts backend/outputs
ok "Directories created"

# ── 3. GPT-SoVITS ──
GPT_DIR="$ROOT/ai-engines/GPT-SoVITS"
if [ ! -d "$GPT_DIR/.git" ]; then
  log "Cloning GPT-SoVITS..."
  git clone https://github.com/RVC-Boss/GPT-SoVITS.git "$GPT_DIR" --depth=1
  ok "GPT-SoVITS cloned"
else
  warn "GPT-SoVITS already cloned — skipping"
fi

# ── 4. RVC ──
RVC_DIR="$ROOT/ai-engines/RVC"
if [ ! -d "$RVC_DIR/.git" ]; then
  log "Cloning RVC v2..."
  git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git "$RVC_DIR" --depth=1
  ok "RVC v2 cloned"
else
  warn "RVC already cloned — skipping"
fi

# ── 5. Python venv + backend deps ──
VENV="$ROOT/backend/.venv"
if [ ! -d "$VENV" ]; then
  log "Creating Python virtual environment..."
  python3 -m venv "$VENV"
fi
source "$VENV/bin/activate"
log "Installing backend Python dependencies..."
pip install --upgrade pip -q
pip install -r "$ROOT/backend/requirements.txt" -q

# PyTorch with CUDA (auto-detect)
if command -v nvidia-smi &>/dev/null; then
  log "NVIDIA GPU detected — installing CUDA PyTorch..."
  pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121 -q
  ok "PyTorch CUDA installed"
else
  warn "No NVIDIA GPU detected — installing CPU PyTorch (inference will be slow)"
  pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu -q
fi

# GPT-SoVITS deps
if [ -f "$GPT_DIR/requirements.txt" ]; then
  pip install -r "$GPT_DIR/requirements.txt" -q 2>/dev/null || warn "Some GPT-SoVITS deps failed"
fi

# RVC deps
if [ -f "$RVC_DIR/requirements.txt" ]; then
  pip install -r "$RVC_DIR/requirements.txt" -q 2>/dev/null || warn "Some RVC deps failed"
fi

ok "Backend dependencies installed"

# ── 6. Frontend deps ──
log "Installing frontend Node.js dependencies..."
cd "$ROOT/frontend"
npm install -q
ok "Frontend dependencies installed"
cd "$ROOT"

# ── Done ──
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "  ▶ Start backend:   source backend/.venv/bin/activate && uvicorn main:app --reload"
echo "     (run from backend/ directory)"
echo ""
echo "  ▶ Start frontend:  npm run dev"
echo "     (run from frontend/ directory)"
echo ""
echo "  ▶ Or use Docker:   docker compose up --build"
echo ""
warn "Add your .pth model files to backend/models_store/rvc/ (for RVC)"
warn "Add your .pth model files to backend/models_store/tts/ (for GPT-SoVITS)"
