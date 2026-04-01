"""Pydantic schemas shared across the backend."""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────

class EngineType(str, Enum):
    EDGE_TTS = "edge_tts"

class JobStatus(str, Enum):
    QUEUED     = "queued"
    PROCESSING = "processing"
    DONE       = "done"
    ERROR      = "error"

class ModelType(str, Enum):
    TTS = "tts"
    VC  = "vc"

class Language(str, Enum):
    TH = "th"
    EN = "en"
    ZH = "zh"
    JA = "ja"


# ─────────────────────────────────────────────────────────────
# Request schemas
# ─────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text:            str       = Field(..., min_length=1, max_length=2000)
    voice_id:        str       = Field("default")
    engine:          EngineType = Field(EngineType.EDGE_TTS)
    language:        Language  = Field(Language.TH)
    speed:           float     = Field(1.0,  ge=0.5, le=2.0)
    pitch:           int       = Field(0,    ge=-12, le=12)
    reference_audio: Optional[str] = Field(None, description="Base64-encoded wav/mp3")
    reference_text:  Optional[str] = Field(None, max_length=500)


class VCParams(BaseModel):
    model_name:   str   = Field(..., min_length=1)
    pitch_shift:  int   = Field(0,    ge=-24, le=24)
    index_rate:   float = Field(0.75, ge=0.0, le=1.0)
    filter_radius:int   = Field(3,    ge=0,   le=7)
    rms_mix_rate: float = Field(0.25, ge=0.0, le=1.0)
    protect:      float = Field(0.33, ge=0.0, le=0.5)


# ─────────────────────────────────────────────────────────────
# Response schemas
# ─────────────────────────────────────────────────────────────

class JobResponse(BaseModel):
    job_id: str


class JobStatusResponse(BaseModel):
    job_id:      str
    status:      JobStatus
    progress:    int       = Field(0, ge=0, le=100)
    result_url:  Optional[str]  = None
    error:       Optional[str]  = None
    engine_used: Optional[str]  = None
    duration_ms: Optional[int]  = None


class ModelInfo(BaseModel):
    name:        str
    type:        ModelType
    engine:      str
    language:    Optional[str] = None
    description: Optional[str] = None
    size_mb:     Optional[float] = None


class ModelsResponse(BaseModel):
    models: list[ModelInfo]


class HealthResponse(BaseModel):
    status:  str
    engines: dict[str, bool]
    gpu:     Optional[str]
    version: str = "1.0.0"
