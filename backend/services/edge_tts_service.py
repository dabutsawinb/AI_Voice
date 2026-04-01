"""
Edge TTS Service — Microsoft Edge Neural TTS
Fast, free, no GPU required. Used as fallback when GPT-SoVITS is not loaded.
Supports Thai, English, Chinese, Japanese and 40+ languages.
"""
from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING

import edge_tts
import soundfile as sf
import librosa
import numpy as np
from loguru import logger

if TYPE_CHECKING:
    from models.schemas import TTSRequest
    from utils.jobs import Job

# ── Voice mappings per language ──
VOICE_MAP: dict[str, str] = {
    "th": "th-TH-NiwatNeural",       # Thai male (natural)
    "th_f": "th-TH-PremwadeeNeural", # Thai female
    "en": "en-US-AriaNeural",
    "en_m": "en-US-GuyNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
}


class EdgeTTSService:
    """Singleton wrapper around edge-tts library."""

    _instance: "EdgeTTSService | None" = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        logger.info("EdgeTTSService ready (no model loading required)")

    def is_ready(self) -> bool:
        return True   # Edge TTS is always available (needs internet)

    async def synthesize(self, req: "TTSRequest", job: "Job") -> str:
        """
        Generate speech using Edge TTS.
        Returns path to output WAV file.
        """
        job.progress = 10

        # Pick voice
        voice = self._pick_voice(req.language.value, req.voice_id)
        logger.info(f"Edge TTS: lang={req.language} voice={voice} text_len={len(req.text)}")

        # Build rate and pitch strings
        rate_pct  = int((req.speed - 1.0) * 100)
        pitch_hz  = req.pitch * 5  # approx: 1 semitone ≈ 5 Hz for Edge TTS
        rate_str  = f"{'+' if rate_pct >= 0 else ''}{rate_pct}%"
        pitch_str = f"{'+' if pitch_hz >= 0 else ''}{pitch_hz}Hz"

        job.progress = 20

        # Synthesize to temp mp3
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp_path = tmp.name

        communicate = edge_tts.Communicate(
            text=req.text,
            voice=voice,
            rate=rate_str,
            pitch=pitch_str,
        )
        await communicate.save(tmp_path)
        job.progress = 70

        # Convert mp3 → normalized wav
        out_path = tempfile.mktemp(suffix=".wav")
        audio, sr = librosa.load(tmp_path, sr=44100, mono=True)
        audio = self._normalize(audio)
        sf.write(out_path, audio, sr, subtype="PCM_16")

        Path(tmp_path).unlink(missing_ok=True)
        job.progress = 95

        logger.success(f"Edge TTS done → {out_path} ({len(audio)/sr:.1f}s)")
        return out_path

    # ── Helpers ──

    def _pick_voice(self, language: str, voice_id: str) -> str:
        """Map language + voice_id to an Edge TTS voice name."""
        if voice_id and voice_id not in ("default", ""):
            # Allow passing a raw Edge voice name directly
            return voice_id
        return VOICE_MAP.get(language, VOICE_MAP["en"])

    @staticmethod
    def _normalize(audio: np.ndarray, target_db: float = -20.0) -> np.ndarray:
        """RMS-normalize to target dBFS."""
        rms = np.sqrt(np.mean(audio ** 2))
        if rms > 0:
            target_rms = 10 ** (target_db / 20)
            audio = audio * (target_rms / rms)
        return np.clip(audio, -1.0, 1.0)

    async def list_voices(self, language: str | None = None) -> list[dict]:
        """Return all available Edge TTS voices, optionally filtered by language."""
        voices = await edge_tts.list_voices()
        if language:
            voices = [v for v in voices if v["Locale"].startswith(language)]
        return [{"name": v["ShortName"], "locale": v["Locale"], "gender": v["Gender"]} for v in voices]
