"""Jobs Router — poll status and download results."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from models.schemas import JobStatusResponse
from utils.jobs import JobManager

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Poll the status and progress of a synthesis/conversion job."""
    manager = JobManager.get()
    job = manager.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(**job.to_dict())


@router.get("/{job_id}/download")
async def download_job_result(job_id: str):
    """Stream the resulting audio file once the job is done."""
    manager = JobManager.get()
    job = manager.get_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status.value != "done":
        raise HTTPException(
            status_code=425,
            detail=f"Job not finished yet (status={job.status})"
        )

    if not job.result_path or not Path(job.result_path).exists():
        raise HTTPException(status_code=404, detail="Result file not found")

    return FileResponse(
        job.result_path,
        media_type="audio/wav",
        filename=f"{job.engine_used or 'output'}-{job_id[:8]}.wav",
    )
