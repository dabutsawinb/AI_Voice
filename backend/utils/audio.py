"""Audio utility functions: format conversion, validation, normalization."""
from __future__ import annotations

import base64
import io
import os
import tempfile
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from loguru import logger


SUPPORTED_FORMATS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".webm"}
MAX_DURATION_SEC  = 600   # 10 minutes


def load_audio(path: str | Path, sr: int = 44100) -> tuple[np.ndarray, int]:
    """Load any audio file → (float32 array, sample_rate)."""
    y, loaded_sr = librosa.load(str(path), sr=sr, mono=True)
    return y, loaded_sr


def save_wav(audio: np.ndarray, sr: int, path: str | Path) -> None:
    """Write float32 numpy array as 16-bit PCM WAV."""
    sf.write(str(path), audio, sr, subtype="PCM_16")


def normalize_audio(audio: np.ndarray, target_dBFS: float = -20.0) -> np.ndarray:
    """Peak-normalize then RMS-normalize to target dBFS."""
    if audio.max() == 0:
        return audio
    # Peak normalize
    audio = audio / np.max(np.abs(audio))
    # RMS normalize
    rms = np.sqrt(np.mean(audio ** 2))
    if rms > 0:
        target_rms = 10 ** (target_dBFS / 20)
        audio = audio * (target_rms / rms)
    return np.clip(audio, -1.0, 1.0)


def bytes_to_wav(raw_bytes: bytes, output_path: str | Path, sr: int = 44100) -> str:
    """Convert any audio bytes to normalized WAV file. Returns output path."""
    with tempfile.NamedTemporaryFile(suffix=".tmp", delete=False) as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name

    try:
        audio, loaded_sr = librosa.load(tmp_path, sr=sr, mono=True)
        audio = normalize_audio(audio)
        save_wav(audio, sr, output_path)
        logger.debug(f"Converted audio → {output_path} ({len(audio)/sr:.1f}s @ {sr}Hz)")
    finally:
        os.unlink(tmp_path)

    return str(output_path)


def base64_to_wav(b64_str: str, output_path: str | Path, sr: int = 44100) -> str:
    """Decode base64 audio and convert to WAV."""
    raw = base64.b64decode(b64_str)
    return bytes_to_wav(raw, output_path, sr)


def validate_audio_file(path: str | Path) -> dict:
    """Validate audio file and return metadata."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")

    ext = path.suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        raise ValueError(f"Unsupported format: {ext}. Supported: {SUPPORTED_FORMATS}")

    audio, sr = load_audio(path)
    duration = len(audio) / sr

    if duration > MAX_DURATION_SEC:
        raise ValueError(f"Audio too long: {duration:.0f}s (max {MAX_DURATION_SEC}s)")

    if duration < 0.1:
        raise ValueError("Audio too short (< 0.1 second)")

    return {
        "duration_sec": duration,
        "sample_rate":  sr,
        "channels":     1,
        "size_bytes":   path.stat().st_size,
    }


def trim_silence(
    audio: np.ndarray,
    sr: int,
    top_db: float = 30,
    pad_ms: int = 50,
) -> np.ndarray:
    """Trim leading/trailing silence with padding."""
    trimmed, _ = librosa.effects.trim(audio, top_db=top_db)
    pad = int(sr * pad_ms / 1000)
    return np.pad(trimmed, pad)


def audio_to_bytes(audio: np.ndarray, sr: int, fmt: str = "wav") -> bytes:
    """Convert numpy array to audio bytes."""
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format=fmt.upper(), subtype="PCM_16")
    buf.seek(0)
    return buf.read()
