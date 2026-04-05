"""
Smart Note Router — /notes/*
รับไฟล์ video/audio → ถอดเทป (AssemblyAI) → สรุป (Gemini)
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Query
from loguru import logger

from models.schemas import JobResponse, NoteResult, JobStatus, Utterance
from utils.jobs import JobManager
from services.assemblyai_service import AssemblyAIService
from services.gemini_service import GeminiService

router = APIRouter(prefix="/notes", tags=["Smart Note"])

_assemblyai = AssemblyAIService()
_gemini     = GeminiService()

# รองรับไฟล์ประเภทเหล่านี้
ALLOWED_TYPES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
    "audio/flac", "audio/ogg", "audio/webm", "audio/mp4",
    "video/mp4", "video/webm", "video/quicktime",
    "application/octet-stream",  # fallback
}
MAX_FILE_MB = 500


@router.post("/transcribe", response_model=JobResponse)
async def transcribe_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Query("auto", description="รหัสภาษา เช่น th, en, auto"),
):
    """
    อัปโหลด video/audio → ได้ job_id
    poll GET /notes/result/{job_id} เพื่อติดตามผล
    """
    # validate ขนาดไฟล์
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_MB:
        raise HTTPException(400, f"ไฟล์ใหญ่เกิน {MAX_FILE_MB} MB")

    # บันทึกไฟล์ชั่วคราว
    suffix = Path(file.filename or "upload").suffix or ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(content)
    tmp.close()
    tmp_path = tmp.name

    manager = JobManager.get()
    job     = manager.create_job()

    async def _run():
        try:
            job.status   = JobStatus.PROCESSING
            job.progress = 5

            # ─── 1. Transcribe ───
            lang_code = None if language == "auto" else language
            raw = await _assemblyai.transcribe(
                file_path      = tmp_path,
                speaker_labels = True,
                language_code  = lang_code,
                job            = job,
            )

            full_text  = raw.get("text", "")
            raw_utters = raw.get("utterances") or []
            audio_dur  = raw.get("audio_duration")
            detected_lang = raw.get("language_code", "")

            utterances = [
                Utterance(
                    speaker  = u["speaker"],
                    text     = u["text"],
                    start_ms = u["start"],
                    end_ms   = u["end"],
                )
                for u in raw_utters
            ]

            # ─── 2. Summarize ───
            summary_data = await _gemini.summarize(
                transcript_text = full_text,
                utterances      = [u.dict() for u in utterances],
                job             = job,
            )

            # ─── 3. บันทึกผลลัพธ์ลง job ───
            job.extra = {
                "full_text":    full_text,
                "utterances":   [u.dict() for u in utterances],
                "duration_sec": audio_dur,
                "language":     detected_lang,
                **summary_data,
                "engine_used":  "assemblyai+gemini",
            }
            job.status   = JobStatus.DONE
            job.progress = 100

        except Exception as e:
            logger.error(f"Note job {job.job_id} failed: {e}")
            job.status = JobStatus.ERROR
            job.error  = str(e)
        finally:
            # ลบไฟล์ temp
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    background_tasks.add_task(_run)
    return JobResponse(job_id=job.job_id)


@router.get("/result/{job_id}", response_model=NoteResult)
async def get_note_result(job_id: str):
    """ดูผลลัพธ์ของ job — poll จนกว่า status = done"""
    manager = JobManager.get()
    job     = manager.get_job(job_id)
    if not job:
        raise HTTPException(404, "ไม่พบ job นี้")

    extra = getattr(job, "extra", {}) or {}

    return NoteResult(
        job_id       = job.job_id,
        status       = job.status,
        progress     = job.progress,
        full_text    = extra.get("full_text"),
        utterances   = [Utterance(**u) for u in extra.get("utterances", [])],
        duration_sec = extra.get("duration_sec"),
        language     = extra.get("language"),
        summary      = extra.get("summary"),
        key_points   = extra.get("key_points"),
        action_items = extra.get("action_items"),
        topics       = extra.get("topics"),
        error        = job.error,
        engine_used  = extra.get("engine_used"),
    )


@router.get("/engines")
async def note_engines():
    return {
        "assemblyai": _assemblyai.is_ready(),
        "gemini":     _gemini.is_ready(),
    }
