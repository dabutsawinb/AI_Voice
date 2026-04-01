"""Models Router — upload & list voice models."""
from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from loguru import logger

from models.schemas import ModelInfo, ModelsResponse, ModelType
from services.rvc_service import RVCService
from services.gpt_sovits import GPTSoVITSService

router = APIRouter(prefix="/models", tags=["Models"])

_rvc_svc       = RVCService()
_gpt_sovits_svc = GPTSoVITSService()

MODELS_BASE = Path("models_store")
RVC_DIR     = MODELS_BASE / "rvc"
TTS_DIR     = MODELS_BASE / "tts"

RVC_DIR.mkdir(parents=True, exist_ok=True)
TTS_DIR.mkdir(parents=True, exist_ok=True)


@router.get("", response_model=ModelsResponse)
async def list_all_models():
    """List all available TTS and VC models."""
    models: list[ModelInfo] = []

    # RVC models
    for pth in RVC_DIR.glob("*.pth"):
        models.append(ModelInfo(
            name=pth.stem,
            type=ModelType.VC,
            engine="rvc_v2",
            description="RVC v2 voice model",
            size_mb=round(pth.stat().st_size / 1_048_576, 1),
        ))

    # GPT-SoVITS models
    for pth in TTS_DIR.glob("*.pth"):
        models.append(ModelInfo(
            name=pth.stem,
            type=ModelType.TTS,
            engine="gpt_sovits",
            description="GPT-SoVITS voice model",
            size_mb=round(pth.stat().st_size / 1_048_576, 1),
        ))

    # Edge TTS always available
    models.append(ModelInfo(
        name="edge_tts_default",
        type=ModelType.TTS,
        engine="edge_tts",
        language="multi",
        description="Microsoft Edge TTS (no GPU required)",
    ))

    return ModelsResponse(models=models)


@router.post("/upload")
async def upload_model(
    file: UploadFile = File(...),
    type: ModelType  = Form(...),
):
    """Upload a .pth model file for TTS or VC."""
    if not file.filename or not file.filename.endswith(".pth"):
        raise HTTPException(status_code=400, detail="Only .pth files are accepted")

    dest_dir = TTS_DIR if type == ModelType.TTS else RVC_DIR
    dest     = dest_dir / file.filename

    if dest.exists():
        raise HTTPException(status_code=409, detail=f"Model '{file.filename}' already exists")

    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    size_mb = round(dest.stat().st_size / 1_048_576, 1)
    logger.info(f"Uploaded {type} model: {file.filename} ({size_mb} MB)")

    return {"name": dest.stem, "type": type, "size_mb": size_mb}


@router.delete("/{model_type}/{model_name}")
async def delete_model(model_type: ModelType, model_name: str):
    """Delete a model file."""
    dest_dir = TTS_DIR if model_type == ModelType.TTS else RVC_DIR
    target   = dest_dir / f"{model_name}.pth"

    if not target.exists():
        raise HTTPException(status_code=404, detail="Model not found")

    target.unlink()
    logger.info(f"Deleted model: {model_name}")
    return {"deleted": model_name}
