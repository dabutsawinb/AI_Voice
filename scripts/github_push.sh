#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
#  AI Voice Studio — GitHub Setup Script
#  รันบน WSL: bash scripts/github_push.sh
# ════════════════════════════════════════════════════════════
set -e

REPO_NAME="ai-voice-studio"
GITHUB_USER=""   # ← ใส่ GitHub username ของคุณ

# ── สีสำหรับ output ──
GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${BLUE}══════════════════════════════════════${NC}"
echo -e "${BLUE}  AI Voice Studio — GitHub Setup${NC}"
echo -e "${BLUE}══════════════════════════════════════${NC}"

# ── 1. ลบ .git เดิมถ้ามี (broken) ──
if [ -d ".git" ]; then
    echo -e "${YELLOW}► ลบ .git เดิม...${NC}"
    rm -rf .git
fi

# ── 2. git init ──
echo -e "${GREEN}► git init...${NC}"
git init -b main
git config user.email "winzarza01@gmail.com"
git config user.name "Dabutsawin"

# ── 3. Stage ทุกไฟล์ ──
echo -e "${GREEN}► เพิ่มไฟล์ทั้งหมด...${NC}"
git add .
git status --short | head -30

# ── 4. Initial commit ──
echo -e "${GREEN}► Initial commit...${NC}"
git commit -m "feat: initial commit — AI Voice Studio

- Next.js 14 + TypeScript frontend with TTS & VC panels
- FastAPI async backend with job queue
- RVC v2 (Applio) voice conversion engine
- Edge TTS (Microsoft Neural TTS) text-to-speech
- WaveSurfer-free audio player with native HTML5
- Docker Compose GPU support
- Status bar with real-time engine health"

echo -e "${GREEN}✓ Git repo พร้อมแล้ว!${NC}"
echo ""

# ── 5. ติดตั้ง gh CLI (ถ้ายังไม่มี) ──
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}► ติดตั้ง GitHub CLI...${NC}"
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    sudo apt-get update -qq && sudo apt-get install -y gh
    echo -e "${GREEN}✓ ติดตั้ง gh CLI สำเร็จ${NC}"
fi

# ── 6. Login GitHub ──
echo ""
echo -e "${YELLOW}► Login GitHub (เปิด browser หรือใช้ token)...${NC}"
gh auth login

# ── 7. สร้าง repo และ push ──
echo ""
echo -e "${GREEN}► สร้าง GitHub repo และ push...${NC}"
gh repo create "$REPO_NAME" \
    --public \
    --description "AI Voice Studio — TTS & Voice Conversion with RVC v2 + Edge TTS" \
    --push \
    --source=.

echo ""
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Push สำเร็จ!${NC}"
echo -e "${GREEN}  https://github.com/$(gh api user --jq .login)/${REPO_NAME}${NC}"
echo -e "${GREEN}══════════════════════════════════════${NC}"
