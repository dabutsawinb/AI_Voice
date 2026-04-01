param (
    [switch]$Help
)

$ErrorActionPreference = "Stop"

$BLUE = "`e[0;34m"
$GREEN = "`e[0;32m"
$YELLOW = "`e[1;33m"
$RED = "`e[0;31m"
$NC = "`e[0m"

function log($msg) { Write-Host "[Setup] $msg" -ForegroundColor Cyan }
function ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function warn($msg) { Write-Host "[Warn] $msg" -ForegroundColor Yellow }
function err($msg) { Write-Host "[Error] $msg" -ForegroundColor Red; exit 1 }

$ROOT = $PSScriptRoot | Split-Path -Parent
Set-Location $ROOT

log "AI Voice Studio Setup (Windows)"
log "Root: $ROOT"

# 1. Copy .env
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item .env.example .env
        ok "Created .env from .env.example"
    } else {
        warn ".env.example not found, skipping .env creation"
    }
} else {
    warn ".env already exists - skipping"
}

# 2. Create directories
$directories = @(
    "ai-engines",
    "backend\models_store\rvc",
    "backend\models_store\tts",
    "backend\outputs"
)
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}
ok "Directories created"

# 3. GPT-SoVITS
$GPT_DIR = Join-Path $ROOT "ai-engines\GPT-SoVITS"
if (-not (Test-Path "$GPT_DIR\.git")) {
    log "Cloning GPT-SoVITS..."
    git clone https://github.com/RVC-Boss/GPT-SoVITS.git $GPT_DIR --depth=1
    ok "GPT-SoVITS cloned"
} else {
    warn "GPT-SoVITS already cloned - skipping"
}

# 4. RVC
$RVC_DIR = Join-Path $ROOT "ai-engines\RVC"
if (-not (Test-Path "$RVC_DIR\.git")) {
    log "Cloning RVC v2..."
    git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git $RVC_DIR --depth=1
    ok "RVC v2 cloned"
} else {
    warn "RVC already cloned - skipping"
}

# 5. Python venv + backend deps
$VENV = Join-Path $ROOT "backend\.venv"
if (-not (Test-Path $VENV)) {
    log "Creating Python virtual environment..."
    python -m venv $VENV
}

log "Installing backend Python dependencies..."
# Activation in powershell is done within the process by calling the script,
# but for running pip we can just call the venv's pip executable directly.
$PIP = "$VENV\Scripts\pip.exe"
& $PIP install --upgrade pip -q
& $PIP install -r "$ROOT\backend\requirements.txt" -q

# PyTorch with CUDA (auto-detect)
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    log "NVIDIA GPU detected - installing CUDA PyTorch..."
    & $PIP install torch torchaudio --index-url https://download.pytorch.org/whl/cu121 -q
    ok "PyTorch CUDA installed"
} else {
    warn "No NVIDIA GPU detected - installing CPU PyTorch (inference will be slow)"
    & $PIP install torch torchaudio --index-url https://download.pytorch.org/whl/cpu -q
}

# GPT-SoVITS deps
if (Test-Path "$GPT_DIR\requirements.txt") {
    & $PIP install -r "$GPT_DIR\requirements.txt" -q 2>$null
    if ($LASTEXITCODE -ne 0) { warn "Some GPT-SoVITS deps failed (Ignorable)" }
}

# RVC deps
if (Test-Path "$RVC_DIR\requirements.txt") {
    & $PIP install -r "$RVC_DIR\requirements.txt" -q 2>$null
    if ($LASTEXITCODE -ne 0) { warn "Some RVC deps failed (Ignorable)" }
}

ok "Backend dependencies installed"

# 6. Frontend deps
log "Installing frontend Node.js dependencies..."
Set-Location "$ROOT\frontend"
npm install -q
ok "Frontend dependencies installed"

Set-Location $ROOT

# Done
Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓ Setup Complete!" -ForegroundColor Green
Write-Host "════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  ▶ Start backend:   cd backend; .\.venv\Scripts\Activate.ps1; uvicorn main:app --reload"
Write-Host ""
Write-Host "  ▶ Start frontend:  cd frontend; npm run dev"
Write-Host ""
Write-Host "  ▶ Or use Docker:   docker-compose up --build"
Write-Host ""
Write-Host "  [Warn] Add your .pth model files to backend\models_store\rvc\ (for RVC)" -ForegroundColor Yellow
Write-Host "  [Warn] Add your .pth model files to backend\models_store\tts\ (for GPT-SoVITS)" -ForegroundColor Yellow
