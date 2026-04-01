"""
RVC v2 Service — ใช้ Applio (Python 3.12 compatible)
Clone Applio ไว้ที่: ai-engines/Applio
Place .pth model files in: backend/models_store/rvc/
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from models.schemas import VCParams
    from utils.jobs import Job

APPLIO_PATH = os.getenv(
    "APPLIO_PATH",
    str(Path(__file__).parent.parent.parent / "ai-engines" / "Applio")
)
MODELS_DIR = Path(os.getenv("RVC_MODELS_DIR", "models_store/rvc"))


class RVCService:
    _instance: "RVCService | None" = None
    _ready = False
    _loaded_model: str = ""
    _vc_func = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self._try_load()

    def _try_load(self) -> None:
        applio_path = Path(APPLIO_PATH)
        if not applio_path.exists():
            logger.warning(
                f"Applio not found at {applio_path}\n"
                "ติดตั้งด้วย: git clone https://github.com/IAHispano/Applio.git "
                f"ai-engines/Applio --depth=1"
            )
            return

        try:
            if str(applio_path) not in sys.path:
                sys.path.insert(0, str(applio_path))

            # ต้อง chdir ไปที่ Applio ก่อน เพราะ core.py ใช้ relative path
            original_dir = os.getcwd()
            os.chdir(str(applio_path))

            try:
                from core import run_infer_script  # type: ignore
                self._vc_func = run_infer_script
                self._applio_path = str(applio_path)
                self._ready = True
                logger.success(f"Applio RVC loaded from {applio_path}")
            finally:
                os.chdir(original_dir)

        except Exception as e:
            logger.warning(f"Applio import failed: {e}")
            self._try_load_rvc_direct(applio_path)

    def _try_load_rvc_direct(self, applio_path: Path) -> None:
        """Fallback: ใช้ rvc module ใน Applio โดยตรง"""
        try:
            rvc_path = applio_path / "rvc"
            if str(rvc_path) not in sys.path:
                sys.path.insert(0, str(rvc_path))

            from infer.infer import VoiceConverter  # type: ignore
            self._VoiceConverter = VoiceConverter
            self._ready = True
            logger.success("Applio RVC (direct) loaded")
        except Exception as e:
            logger.warning(f"Applio direct load failed: {e}")

    def is_ready(self) -> bool:
        return self._ready

    def model_exists(self, model_name: str) -> bool:
        return (MODELS_DIR / f"{model_name}.pth").exists()

    def list_models(self) -> list[str]:
        if not MODELS_DIR.exists():
            return []
        return [p.stem for p in sorted(MODELS_DIR.glob("*.pth"))]

    async def convert(
        self,
        input_audio_path: str,
        params: "VCParams",
        job: "Job",
    ) -> str:
        if not self._ready:
            raise RuntimeError(
                "RVC ยังไม่พร้อม — clone Applio ก่อน:\n"
                "git clone https://github.com/IAHispano/Applio.git ai-engines/Applio --depth=1\n"
                "cd ai-engines/Applio && pip install -r requirements.txt"
            )

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._run_conversion,
            input_audio_path,
            params,
            job,
        )

    def _run_conversion(
        self,
        input_path: str,
        params: "VCParams",
        job: "Job",
    ) -> str:
        import torch

        # บังคับให้ทุก path เป็น absolute เพราะจะ chdir ไป Applio
        model_path = str(Path(MODELS_DIR / f"{params.model_name}.pth").resolve())
        index_path = str(Path(MODELS_DIR / f"{params.model_name}.index").resolve())
        has_index  = Path(index_path).exists()
        input_path = str(Path(input_path).resolve())
        out_path   = str(Path(tempfile.mktemp(suffix=".wav")).resolve())

        job.progress = 15
        logger.info(f"RVC converting: {params.model_name}")
        logger.info(f"  model_path : {model_path}")
        logger.info(f"  input_path : {input_path}")
        logger.info(f"  out_path   : {out_path}")

        if self._vc_func is not None:
            # ต้อง chdir ไปที่ Applio ก่อนทุกครั้งที่ infer
            original_dir = os.getcwd()
            os.chdir(self._applio_path)
            try:
                self._vc_func(
                    pitch                    = params.pitch_shift,
                    index_rate               = params.index_rate,
                    volume_envelope          = params.rms_mix_rate,
                    protect                  = params.protect,
                    f0_method                = "rmvpe",
                    input_path               = input_path,
                    output_path              = out_path,
                    pth_path                 = model_path,
                    index_path               = index_path if has_index else "",
                    split_audio              = False,
                    f0_autotune              = False,
                    f0_autotune_strength     = 1.0,
                    proposed_pitch           = False,
                    proposed_pitch_threshold = 255.0,
                    clean_audio              = True,
                    clean_strength           = 0.7,
                    export_format            = "WAV",
                    embedder_model           = "contentvec",
                    embedder_model_custom    = None,
                    formant_shifting         = False,
                    formant_qfrency          = 1.0,
                    formant_timbre           = 1.0,
                    post_process             = False,
                    reverb                   = False,
                    pitch_shift              = False,
                    limiter                  = False,
                    gain                     = False,
                    distortion               = False,
                    chorus                   = False,
                    bitcrush                 = False,
                    clipping                 = False,
                    compressor               = False,
                    delay                    = False,
                )
            finally:
                os.chdir(original_dir)
        elif hasattr(self, "_VoiceConverter"):
            # fallback direct
            vc = self._VoiceConverter()
            vc.convert_audio(
                audio_input_path  = input_path,
                audio_output_path = out_path,
                model_path        = model_path,
                index_path        = index_path if has_index else "",
                pitch             = params.pitch_shift,
                f0_method         = "rmvpe",
                index_rate        = params.index_rate,
                filter_radius     = params.filter_radius,
                rms_mix_rate      = params.rms_mix_rate,
                protect           = params.protect,
                split_audio       = False,
                f0_autotune       = False,
                clean_audio       = True,
                clean_strength    = 0.7,
                export_format     = "WAV",
                upscale_audio     = False,
                resample_sr       = 0,
                sid               = 0,
            )
        else:
            raise RuntimeError("ไม่พบ RVC inference function")

        job.progress = 90

        if not Path(out_path).exists() or Path(out_path).stat().st_size == 0:
            raise RuntimeError("RVC ไม่ได้สร้างไฟล์ output")

        logger.success(f"RVC done → {out_path}")
        return out_path
