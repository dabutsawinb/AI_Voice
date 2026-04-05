"""
Gemini 1.5 Flash Summarization Service
- รับ transcript → สรุปประเด็น + Action Items
"""
from __future__ import annotations

import os
from loguru import logger

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


class GeminiService:
    """Singleton wrapper สำหรับ Gemini 1.5 Flash"""

    _instance: "GeminiService | None" = None
    _model = None

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

    def _try_load(self):
        if not GEMINI_API_KEY:
            logger.warning("ยังไม่ได้ตั้งค่า GEMINI_API_KEY — summarization จะใช้ไม่ได้")
            return
        try:
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            # เก็บ reference ไว้ก่อน จะหา model ที่ใช้ได้ตอน call จริง
            self._genai   = genai
            self._model   = True   # flag ว่าพร้อมใช้
            self._model_name = None  # จะ detect ตอน call แรก
            logger.success("Gemini service ready (model will be detected on first call)")
        except Exception as e:
            logger.warning(f"Gemini load failed: {e}")

    def is_ready(self) -> bool:
        return self._model is not None

    async def summarize(self, transcript_text: str, utterances: list, job=None) -> dict:
        """
        ส่ง transcript ให้ Gemini สรุป → return {
            summary: str,
            key_points: list[str],
            action_items: list[str],
            topics: list[str]
        }
        """
        if not self.is_ready():
            # fallback — ถ้าไม่มี Gemini ให้ return empty summary
            return {
                "summary": "⚠️ ยังไม่ได้ตั้งค่า GEMINI_API_KEY — ไม่สามารถสรุปได้",
                "key_points": [],
                "action_items": [],
                "topics": [],
            }

        import asyncio

        # สร้าง prompt พร้อม transcript
        formatted = self._format_transcript(utterances, transcript_text)

        prompt = f"""คุณเป็น AI ผู้ช่วยสรุปการประชุมและเนื้อหาเสียง

วิเคราะห์และสรุป transcript ต่อไปนี้:

{formatted}

ตอบเป็น JSON ในรูปแบบนี้เท่านั้น (ไม่ต้องมี markdown code block):
{{
  "summary": "สรุปภาพรวมของการสนทนา 3-5 ประโยค",
  "key_points": ["ประเด็นสำคัญ 1", "ประเด็นสำคัญ 2", "..."],
  "action_items": ["สิ่งที่ต้องทำ 1", "สิ่งที่ต้องทำ 2", "..."],
  "topics": ["หัวข้อ 1", "หัวข้อ 2", "..."]
}}

ถ้าไม่มี action items ให้ใส่ array ว่าง []
ตอบเป็นภาษาเดียวกับ transcript"""

        if job:
            job.progress = 80

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._call_gemini, prompt)

        if job:
            job.progress = 95

        return result

    def _get_active_model(self):
        """Lazy-detect working Gemini model on first call and cache it."""
        if hasattr(self, "_active_model") and self._active_model is not None:
            return self._active_model

        # ดึง model list จาก API จริง
        available: list[str] = []
        try:
            for m in self._genai.list_models():
                name = m.name  # "models/gemini-2.0-flash" etc.
                if "generateContent" in getattr(m, "supported_generation_methods", []):
                    available.append(name.replace("models/", ""))
            logger.info(f"Gemini available models: {available}")
        except Exception as e:
            logger.warning(f"list_models failed: {e}")

        # fallback candidates ถ้า list ว่าง
        if not available:
            available = [
                "gemini-2.0-flash",
                "gemini-2.0-flash-lite",
                "gemini-1.5-flash",
                "gemini-1.5-flash-latest",
                "gemini-1.5-pro",
                "gemini-pro",
            ]

        for name in available:
            try:
                m = self._genai.GenerativeModel(name)
                m.generate_content("hi")
                self._active_model = m
                self._model_name = name
                logger.success(f"Gemini: using model '{name}'")
                return self._active_model
            except Exception as e:
                logger.debug(f"Gemini model '{name}' failed: {e}")

        raise RuntimeError("ไม่พบ Gemini model ที่ใช้งานได้")

    def _call_gemini(self, prompt: str) -> dict:
        import json
        import re

        try:
            model = self._get_active_model()
            response = model.generate_content(prompt)
            text = response.text.strip()

            # ลอง parse JSON
            # ล้าง markdown code block ถ้ามี
            text = re.sub(r"```(?:json)?\s*", "", text).strip("` \n")

            data = json.loads(text)
            return {
                "summary":      data.get("summary", ""),
                "key_points":   data.get("key_points", []),
                "action_items": data.get("action_items", []),
                "topics":       data.get("topics", []),
            }
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            raw = ""
            try:
                raw = response.text  # type: ignore[possibly-undefined]
            except Exception:
                pass
            return {
                "summary": raw or "สรุปไม่สำเร็จ",
                "key_points":   [],
                "action_items": [],
                "topics":       [],
            }

    def _format_transcript(self, utterances: list, fallback_text: str) -> str:
        """แปลง utterances เป็นข้อความที่อ่านง่าย"""
        if utterances:
            lines = []
            for u in utterances:
                start_sec = u.get("start", 0) // 1000
                mm = start_sec // 60
                ss = start_sec % 60
                speaker = u.get("speaker", "?")
                text = u.get("text", "")
                lines.append(f"[{mm:02d}:{ss:02d}] Speaker {speaker}: {text}")
            return "\n".join(lines)
        return fallback_text
