"""TTS Router — handles /tts/* endpoints."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks
from loguru import logger

from models.schemas import TTSRequest, JobResponse
from utils.jobs import JobManager
from services.edge_tts_service import EdgeTTSService

router = APIRouter(prefix="/tts", tags=["Text-to-Speech"])

_edge_tts_svc = EdgeTTSService()


@router.post("/synthesize", response_model=JobResponse)
async def synthesize_speech(
    req: TTSRequest,
    background_tasks: BackgroundTasks,
):
    """Start a TTS job. Returns job_id to poll /jobs/{job_id} for status."""
    manager = JobManager.get()
    job     = manager.create_job()

    async def _run():
        await manager.run_job(job, _edge_tts_svc.synthesize(req, job), "edge_tts")

    background_tasks.add_task(_run)
    return JobResponse(job_id=job.job_id)


@router.get("/engines")
async def list_tts_engines():
    """Return availability of each TTS engine."""
    return {
        "edge_tts": _edge_tts_svc.is_ready(),
    }
