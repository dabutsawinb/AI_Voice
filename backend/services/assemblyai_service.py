"""
AssemblyAI Transcription Service — ใช้ official Python SDK
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Optional

from loguru import logger

ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY", "")


class AssemblyAIService:
    _instance: "AssemblyAIService | None" = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def is_ready(self) -> bool:
        return bool(ASSEMBLYAI_API_KEY)

    async def transcribe(
        self,
        file_path: str,
        speaker_labels: bool = True,
        language_code: Optional[str] = None,
        job=None,
    ) -> dict:
        if not self.is_ready():
            raise RuntimeError(
                "ยังไม่ได้ตั้งค่า ASSEMBLYAI_API_KEY\n"
                "สมัครฟรีที่ https://www.assemblyai.com แล้วใส่ใน .env"
            )

        if job:
            job.progress = 10

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, self._run_transcription, file_path, speaker_labels, language_code, job
        )
        return result

    def _run_transcription(
        self,
        file_path: str,
        speaker_labels: bool,
        language_code: Optional[str],
        job,
    ) -> dict:
        import assemblyai as aai

        aai.settings.api_key = ASSEMBLYAI_API_KEY

        resolved_lang = language_code or "th"

        # AssemblyAI ไม่รองรับ speaker_labels กับภาษาที่ไม่ใช่ English-based
        # → auto-disable speaker_labels สำหรับภาษาที่ไม่รองรับ
        SPEAKER_LABEL_LANGS = {"en", "en_au", "en_uk", "en_us", "fr", "de", "it", "pt", "es", "nl"}
        use_speaker_labels = speaker_labels and (resolved_lang in SPEAKER_LABEL_LANGS)

        if use_speaker_labels:
            # ภาษา EN/EU: ใช้ universal-3-pro + universal-2 + speaker_labels
            config = aai.TranscriptionConfig(
                speech_models=["universal-3-pro", "universal-2"],
                speaker_labels=True,
                language_code=resolved_lang,
            )
        else:
            # ภาษาไทยหรือภาษาอื่น: ใช้ universal-2 เพื่อรองรับ 99 ภาษา, ไม่มี speaker_labels
            config = aai.TranscriptionConfig(
                speech_models=["universal-3-pro", "universal-2"],
                speaker_labels=False,
                language_code=resolved_lang,
            )
            if not use_speaker_labels and speaker_labels:
                logger.warning(f"speaker_labels ถูก disabled เพราะภาษา '{resolved_lang}' ไม่รองรับ")

        logger.info(f"Uploading {Path(file_path).name} to AssemblyAI...")
        if job:
            job.progress = 20

        transcriber = aai.Transcriber(config=config)
        transcript = transcriber.transcribe(file_path)

        if job:
            job.progress = 70

        if transcript.status == aai.TranscriptStatus.error:
            raise RuntimeError(f"AssemblyAI error: {transcript.error}")

        logger.success("Transcription completed!")
        logger.info(f"Utterances count: {len(transcript.utterances) if transcript.utterances else 0}")
        logger.info(f"Words count: {len(transcript.words) if transcript.words else 0}")

        utterances = []

        if transcript.utterances:
            # กรณีปกติ — มี speaker diarization
            for u in transcript.utterances:
                utterances.append({
                    "speaker": u.speaker,
                    "text":    u.text,
                    "start":   u.start,
                    "end":     u.end,
                })
        elif transcript.words and speaker_labels:
            # fallback — รวม words ที่ speaker เดียวกันติดกัน
            logger.warning("utterances empty — building from words")
            current: dict | None = None
            for w in transcript.words:
                spk = getattr(w, "speaker", None) or "A"
                if current is None or current["speaker"] != spk:
                    if current:
                        utterances.append(current)
                    current = {"speaker": spk, "text": w.text, "start": w.start, "end": w.end}
                else:
                    current["text"] += " " + w.text
                    current["end"] = w.end
            if current:
                utterances.append(current)

        return {
            "text":           transcript.text or "",
            "utterances":     utterances,
            "audio_duration": transcript.audio_duration,
            "language_code":  transcript.language_code or language_code or "en",
        }
