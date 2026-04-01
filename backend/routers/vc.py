"""Voice Conversion Router — handles /vc/* endpoints."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile, HTTPException, BackgroundTasks
from loguru import logger

from models.schemas import VCParams, JobResponse
from utils.jobs import JobManager
from utils.audio import bytes_to_wav, validate_audio_file
from services.rvc_service import RVCService

router = APIRouter(prefix="/vc", tags=["Voice Conversion"])

_rvc_svc = RVCService()


@router.post("/convert", response_model=JobResponse)
async def convert_voice(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(..., description="Input audio file"),
    params: str = Form(..., description="JSON-encoded VCParams"),
):
    """
    Start a voice conversion job using RVC v2.

    - `audio`: any audio file (wav/mp3/flac/webm)
    - `params`: JSON string with VCParams fields
    """
    # Parse params
    try:
        vc_params = VCParams(**json.loads(params))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid params: {e}")

    # Save uploaded audio to temp file
    raw_bytes = await audio.read()
    if len(raw_bytes) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    tmp_input = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    input_path = tmp_input.name
    tmp_input.close()

    try:
        bytes_to_wav(raw_bytes, input_path)
        validate_audio_file(input_path)
    except Exception as e:
        Path(input_path).unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(e))

    # Check model exists
    if not _rvc_svc.model_exists(vc_params.model_name):
        raise HTTPException(
            status_code=404,
            detail=f"RVC model '{vc_params.model_name}' not found. "
                   f"Available: {_rvc_svc.list_models()}"
        )

    manager = JobManager.get()
    job     = manager.create_job()

    async def _run():
        try:
            coro = _rvc_svc.convert(input_path, vc_params, job)
            await manager.run_job(job, coro, "rvc_v2")
        finally:
            Path(input_path).unlink(missing_ok=True)

    background_tasks.add_task(_run)
    return JobResponse(job_id=job.job_id)


@router.get("/models")
async def list_vc_models():
    """List available RVC v2 models."""
    return {"models": _rvc_svc.list_models()}
