"""
GPT-SoVITS Service
Wraps the GPT-SoVITS inference pipeline for high-quality TTS.

GPT-SoVITS GitHub: https://github.com/RVC-Boss/GPT-SoVITS
Setup: Clone GPT-SoVITS into /ai-engines/GPT-SoVITS and set GPT_SOVITS_PATH env var.

If GPT-SoVITS is not installed, the service gracefully marks itself as NOT ready,
and the backend auto-falls back to Edge TTS.
"""
from __future__ import annotations

import asyncio
import base64
import os
import sys
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING, Optional

import numpy as np
import soundfile as sf
from loguru import logger

if TYPE_CHECKING:
    from models.schemas import TTSRequest
    from utils.jobs import Job

# ── GPT-SoVITS path configuration ──
GPT_SOVITS_PATH = os.getenv(
    "GPT_SOVITS_PATH",
    str(Path(__file__).parent.parent.parent / "ai-engines" / "GPT-SoVITS")
)


class GPTSoVITSService:
    """Singleton that lazily loads GPT-SoVITS inference pipeline."""

    _instance: "GPTSoVITSService | None" = None
    _ready = False

    # GPT-SoVITS inference objects (loaded once)
    _gpt_model   = None
    _sovits_model = None
    _tokenizer   = None
    _bert_model  = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._try_load()

    def _try_load(self) -> None:
        """Try to import GPT-SoVITS. Non-fatal if not installed."""
        gpt_path = Path(GPT_SOVITS_PATH)
        if not gpt_path.exists():
            logger.warning(
                f"GPT-SoVITS not found at {gpt_path}. "
                "TTS will use Edge TTS fallback. "
                "To enable: clone https://github.com/RVC-Boss/GPT-SoVITS "
                f"to {gpt_path}"
            )
            return

        try:
            # Add GPT-SoVITS to sys.path
            if str(gpt_path) not in sys.path:
                sys.path.insert(0, str(gpt_path))

            # Lazy import — only runs if GPT-SoVITS is present
            from GPT_SoVITS.inference_webui import (  # type: ignore
                get_tts_wav,
                change_gpt_weights,
                change_sovits_weights,
            )
            self._get_tts_wav          = get_tts_wav
            self._change_gpt_weights   = change_gpt_weights
            self._change_sovits_weights = change_sovits_weights

            self._ready = True
            logger.success(f"GPT-SoVITS loaded from {gpt_path}")
        except Exception as exc:
            logger.warning(f"GPT-SoVITS import failed ({exc}). Using Edge TTS fallback.")

    def is_ready(self) -> bool:
        return self._ready

    def load_model(self, gpt_ckpt: str, sovits_ckpt: str) -> None:
        """Load specific GPT + SoVITS checkpoint pair."""
        if not self._ready:
            raise RuntimeError("GPT-SoVITS not installed")
        self._change_gpt_weights(gpt_ckpt)
        self._change_sovits_weights(sovits_ckpt)
        logger.info(f"Loaded GPT: {gpt_ckpt}, SoVITS: {sovits_ckpt}")

    async def synthesize(self, req: "TTSRequest", job: "Job") -> str:
        """
        Run GPT-SoVITS TTS inference in a thread pool (blocking → async).
        Returns path to output WAV.
        """
        if not self._ready:
            raise RuntimeError("GPT-SoVITS not ready")

        job.progress = 10

        # Decode reference audio from base64 → temp wav
        ref_wav_path: Optional[str] = None
        if req.reference_audio:
            raw = base64.b64decode(req.reference_audio)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(raw)
                ref_wav_path = f.name

        job.progress = 20

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._run_inference,
            req,
            ref_wav_path,
            job,
        )

        if ref_wav_path:
            Path(ref_wav_path).unlink(missing_ok=True)

        return result

    def _run_inference(
        self,
        req: "TTSRequest",
        ref_wav_path: Optional[str],
        job: "Job",
    ) -> str:
        """Blocking inference call — runs in thread pool."""
        import torch

        job.progress = 30

        try:
            # GPT-SoVITS get_tts_wav returns a generator of (sr, audio_data)
            gen = self._get_tts_wav(
                ref_wav_path=ref_wav_path or "",
                prompt_text=req.reference_text or "",
                prompt_language=req.language.value,
                text=req.text,
                text_language=req.language.value,
                how_to_cut="凑四句一切",   # sentence grouping strategy
                top_k=5,
                top_p=1.0,
                temperature=1.0,
                ref_free=(ref_wav_path is None),
                speed=req.speed,
            )

            job.progress = 60

            # Collect all chunks
            sr = 32000
            chunks = []
            for sr, chunk in gen:
                if isinstance(chunk, np.ndarray):
                    chunks.append(chunk)

            if not chunks:
                raise RuntimeError("GPT-SoVITS returned empty audio")

            audio = np.concatenate(chunks).astype(np.float32)

            # Apply pitch shift if requested
            if req.pitch != 0:
                import librosa
                audio = librosa.effects.pitch_shift(
                    audio, sr=sr, n_steps=req.pitch
                )

            job.progress = 90

            out_path = tempfile.mktemp(suffix=".wav")
            sf.write(out_path, audio, sr, subtype="PCM_16")
            logger.success(f"GPT-SoVITS done → {out_path}")
            return out_path

        except Exception as exc:
            logger.error(f"GPT-SoVITS inference error: {exc}")
            raise
