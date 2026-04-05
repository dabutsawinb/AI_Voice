"""
AI Voice Studio — FastAPI Backend
Entry point: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")  # โหลด .env ก่อนทุกอย่าง

import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from models.schemas import HealthResponse
from routers import tts, vc, jobs, models as models_router, notes
from utils.jobs import JobManager


# ─────────────────────────────────────────────────────────────
# Startup / Shutdown
# ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize AI engines on startup, cleanup on shutdown."""
    logger.info("Starting AI Voice Studio backend...")

    # Pre-load services lazily (they self-initialize on first use)
    from services.rvc_service import RVCService
    from services.edge_tts_service import EdgeTTSService
    from services.gemini_service import GeminiService

    RVCService()
    EdgeTTSService()
    GeminiService()

    logger.info("All services initialized.")

    # Background job cleanup task (every 10 min)
    async def _cleanup():
        while True:
            await asyncio.sleep(600)
            n = JobManager.get().cleanup_old_jobs()
            if n:
                logger.info(f"Cleaned up {n} old jobs")

    cleanup_task = asyncio.create_task(_cleanup())

    yield  # ← app runs here

    cleanup_task.cancel()
    logger.info("Backend shutdown complete.")


# ─────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Voice Studio API",
    description="RVC v2 · Edge TTS — Voice Synthesis & Conversion",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js dev server and production domain
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(tts.router)
app.include_router(vc.router)
app.include_router(jobs.router)
app.include_router(models_router.router)
app.include_router(notes.router)


# ─────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    from services.rvc_service import RVCService
    from services.edge_tts_service import EdgeTTSService

    gpu_name: str | None = None
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)

    from services.gemini_service import GeminiService
    from services.assemblyai_service import AssemblyAIService

    engines = {
        "rvc_v2":     RVCService().is_ready(),
        "edge_tts":   EdgeTTSService().is_ready(),
        "assemblyai": AssemblyAIService().is_ready(),
        "gemini":     GeminiService().is_ready(),
    }

    return HealthResponse(
        status="ok",
        engines=engines,
        gpu=gpu_name,
    )


@app.get("/", tags=["System"])
async def root():
    return {
        "name":    "AI Voice Studio API",
        "version": "1.0.0",
        "docs":    "/docs",
    }
