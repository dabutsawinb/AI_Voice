"""In-memory job queue manager (Redis-backed optional)."""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import Callable, Coroutine, Any, Optional
from loguru import logger

from models.schemas import JobStatus


class Job:
    def __init__(self, job_id: str):
        self.job_id      = job_id
        self.status      = JobStatus.QUEUED
        self.progress    = 0
        self.result_path: Optional[str] = None
        self.error:       Optional[str] = None
        self.engine_used: Optional[str] = None
        self.created_at  = time.time()
        self.duration_ms: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "job_id":      self.job_id,
            "status":      self.status,
            "progress":    self.progress,
            "result_url":  f"/jobs/{self.job_id}/download" if self.result_path else None,
            "error":       self.error,
            "engine_used": self.engine_used,
            "duration_ms": self.duration_ms,
        }


class JobManager:
    """Simple in-memory job store. Swap for Redis in production."""

    _instance: Optional["JobManager"] = None
    TTL_SECONDS = 3600  # keep jobs for 1 hour

    def __init__(self):
        self._jobs: dict[str, Job] = {}
        self._lock = asyncio.Lock()

    @classmethod
    def get(cls) -> "JobManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def create_job(self) -> Job:
        job_id = str(uuid.uuid4())
        job = Job(job_id)
        self._jobs[job_id] = job
        logger.info(f"Job created: {job_id}")
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    async def run_job(
        self,
        job: Job,
        coro: Coroutine[Any, Any, str],
        engine_name: str = "unknown",
    ) -> None:
        """Run a coroutine as a background job, updating job status."""
        start = time.time()
        job.status      = JobStatus.PROCESSING
        job.engine_used = engine_name
        job.progress    = 5

        try:
            result_path = await coro
            job.result_path = result_path
            job.status      = JobStatus.DONE
            job.progress    = 100
            job.duration_ms = int((time.time() - start) * 1000)
            logger.success(f"Job {job.job_id} done in {job.duration_ms}ms")
        except Exception as exc:
            job.status  = JobStatus.ERROR
            job.error   = str(exc)
            job.progress = 0
            logger.error(f"Job {job.job_id} failed: {exc}")

    def cleanup_old_jobs(self) -> int:
        """Remove jobs older than TTL. Returns count removed."""
        now = time.time()
        expired = [
            jid for jid, j in self._jobs.items()
            if now - j.created_at > self.TTL_SECONDS
        ]
        for jid in expired:
            # Remove result file if exists
            j = self._jobs.pop(jid)
            if j.result_path:
                try:
                    import os
                    os.unlink(j.result_path)
                except Exception:
                    pass
        return len(expired)
