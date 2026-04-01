# 🎙️ AI Voice Studio
### ระบบสังเคราะห์และแปลงโฉมเสียงอัจฉริยะ

> **GPT-SoVITS** · **RVC v2** · **Edge TTS** — Local GPU · Next.js + FastAPI

---

## ภาพรวมระบบ

ระบบนี้รวมเอาความสามารถ AI ด้านเสียง 2 อย่างไว้ในแอปเดียว:

| โหมด | Engine | คุณสมบัติ |
|------|--------|-----------|
| **Text-to-Speech (TTS)** | GPT-SoVITS | สร้างเสียงจากข้อความ รองรับภาษาไทย/อังกฤษ/จีน/ญี่ปุ่น |
| **Voice Conversion (VC)** | RVC v2 | แปลงเสียงคนหนึ่งเป็นเสียงตัวละครที่ต้องการ |
| **TTS Fallback** | Edge TTS | ใช้เมื่อ GPT-SoVITS ไม่พร้อม ไม่ต้องการ GPU |

---

## โครงสร้างโปรเจกต์

```
ai-voice-system/
├── frontend/                   # Next.js 14 + Tailwind CSS
│   ├── app/
│   │   ├── page.tsx            # หน้าหลัก (Mode selector)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── TTSPanel.tsx        # UI สำหรับ Text-to-Speech
│   │   ├── VCPanel.tsx         # UI สำหรับ Voice Conversion
│   │   ├── WaveformDisplay.tsx # แสดงคลื่นเสียง + เล่น/ดาวน์โหลด
│   │   └── StatusBar.tsx       # แสดงสถานะ Backend + GPU
│   └── lib/
│       └── api.ts              # API client (Axios)
│
├── backend/                    # Python FastAPI
│   ├── main.py                 # Entry point
│   ├── routers/
│   │   ├── tts.py              # POST /tts/synthesize
│   │   ├── vc.py               # POST /vc/convert
│   │   ├── jobs.py             # GET /jobs/{id}, /jobs/{id}/download
│   │   └── models.py           # GET/POST /models
│   ├── services/
│   │   ├── gpt_sovits.py       # GPT-SoVITS inference wrapper
│   │   ├── rvc_service.py      # RVC v2 inference wrapper
│   │   └── edge_tts_service.py # Edge TTS wrapper
│   ├── models/
│   │   └── schemas.py          # Pydantic request/response schemas
│   ├── utils/
│   │   ├── audio.py            # Audio I/O utilities
│   │   └── jobs.py             # In-memory job queue
│   ├── models_store/
│   │   ├── rvc/                # ← วาง .pth ของ RVC ที่นี่
│   │   └── tts/                # ← วาง .pth ของ GPT-SoVITS ที่นี่
│   └── requirements.txt
│
├── ai-engines/                 # (clone ด้วย setup.sh)
│   ├── GPT-SoVITS/
│   └── RVC/
│
├── scripts/
│   └── setup.sh                # One-click setup script
├── docker-compose.yml
└── .env.example
```

---

## การติดตั้ง (Setup)

### วิธีที่ 1: ใช้ Script อัตโนมัติ (แนะนำ)

```bash
# Clone โปรเจกต์นี้
git clone <your-repo-url> ai-voice-system
cd ai-voice-system

# รัน setup script (จะ clone GPT-SoVITS + RVC และติดตั้ง dependencies)
bash scripts/setup.sh
```

### วิธีที่ 2: ติดตั้งเอง (Manual)

#### 1. Clone AI Engines

```bash
mkdir -p ai-engines
git clone https://github.com/RVC-Boss/GPT-SoVITS.git ai-engines/GPT-SoVITS --depth=1
git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git ai-engines/RVC --depth=1
```

#### 2. Backend (Python 3.10+)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# PyTorch CUDA (NVIDIA GPU)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121

# Dependencies ของ AI engines
pip install -r ../ai-engines/GPT-SoVITS/requirements.txt
pip install -r ../ai-engines/RVC/requirements.txt
```

#### 3. Frontend (Node.js 18+)

```bash
cd frontend
npm install
```

#### 4. Environment

```bash
cp .env.example .env
# แก้ไข .env ตามต้องการ
```

---

## การเริ่มใช้งาน

### Development Mode

```bash
# Terminal 1: Backend
cd backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

เปิด **http://localhost:3000** ในเบราว์เซอร์

### Docker (GPU)

```bash
# ต้องติดตั้ง nvidia-container-toolkit ก่อน
docker compose up --build
```

---

## การเพิ่ม Voice Models

### RVC v2 Models (Voice Conversion)

1. ดาวน์โหลดไฟล์ `.pth` ของโมเดล RVC ที่ต้องการ
2. วางไฟล์ใน `backend/models_store/rvc/`
3. (Optional) วางไฟล์ `.index` ชื่อเดียวกันเพื่อเพิ่มคุณภาพ
4. โมเดลจะปรากฏใน UI อัตโนมัติ

**แหล่งดาวน์โหลด RVC Models:**
- [weights.gg](https://weights.gg) — คลัง RVC models ขนาดใหญ่
- [HuggingFace](https://huggingface.co/models?search=rvc)

### GPT-SoVITS Models (TTS)

1. ดาวน์โหลดไฟล์ `.pth` (SoVITS) และ `.ckpt` (GPT)
2. วางใน `backend/models_store/tts/`

---

## API Reference

เปิด Swagger UI ที่ **http://localhost:8000/docs**

| Endpoint | Method | คำอธิบาย |
|----------|--------|-----------|
| `/tts/synthesize` | POST | สร้างเสียงจากข้อความ |
| `/vc/convert` | POST | แปลงเสียง (อัปโหลดไฟล์) |
| `/jobs/{id}` | GET | ดูสถานะ job |
| `/jobs/{id}/download` | GET | ดาวน์โหลดไฟล์เสียงผลลัพธ์ |
| `/models` | GET | รายชื่อ models ทั้งหมด |
| `/models/upload` | POST | อัปโหลด model ใหม่ |
| `/health` | GET | สถานะ backend + GPU |

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU | NVIDIA GTX 1060 6GB | RTX 3080+ |
| VRAM | 4 GB | 8 GB+ |
| RAM | 8 GB | 16 GB+ |
| Storage | 10 GB | 50 GB+ |
| CUDA | 11.8 | 12.1 |
| Python | 3.10 | 3.10 / 3.11 |
| Node.js | 18 | 20 |

> **หมายเหตุ:** Edge TTS (Fallback) ทำงานได้บน CPU ปกติ ไม่ต้องการ GPU

---

## Troubleshooting

**GPT-SoVITS ไม่ทำงาน?**
→ ระบบจะ fallback ไป Edge TTS อัตโนมัติ ตรวจสอบ log ของ backend

**CUDA out of memory?**
→ ลด batch size หรือใช้ Edge TTS แทน

**ไม่มี RVC models?**
→ วางไฟล์ `.pth` ใน `backend/models_store/rvc/` แล้ว refresh หน้าเว็บ

**Backend ไม่ตอบสนอง?**
→ ตรวจสอบว่า backend รันอยู่ที่ port 8000 และ CORS_ORIGINS ถูกต้อง
