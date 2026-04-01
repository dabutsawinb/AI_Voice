import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 minutes — AI inference can be slow
});

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export interface TTSRequest {
  text: string;
  voice_id: string;         // e.g. "default", "thai_female", custom model name
  engine: "gpt_sovits" | "edge_tts";
  language: string;         // "th", "en", "zh", "ja"
  speed: number;            // 0.5 – 2.0
  pitch: number;            // -12 – 12 semitones
  reference_audio?: string; // base64 or filename for GPT-SoVITS reference
  reference_text?: string;  // transcript of reference audio
}

export interface VCRequest {
  model_name: string;       // RVC model filename (without .pth)
  pitch_shift: number;      // semitones, -12 – 12
  index_rate: number;       // 0.0 – 1.0 (feature retrieval strength)
  filter_radius: number;    // 0 – 7 (median filter for pitch)
  rms_mix_rate: number;     // 0.0 – 1.0
  protect: number;          // 0.0 – 0.5
}

export interface JobStatus {
  job_id: string;
  status: "queued" | "processing" | "done" | "error";
  progress: number;         // 0–100
  result_url?: string;
  error?: string;
  engine_used?: string;
  duration_ms?: number;
}

export interface ModelInfo {
  name: string;
  type: "tts" | "vc";
  engine: string;
  language?: string;
  description?: string;
}

// ─────────────────────────────────────────
// TTS API
// ─────────────────────────────────────────
export async function synthesizeSpeech(
  req: TTSRequest,
  onProgress?: (p: number) => void
): Promise<{ job_id: string }> {
  const { data } = await api.post("/tts/synthesize", req);
  return data;
}

export async function pollJobStatus(
  jobId: string
): Promise<JobStatus> {
  const { data } = await api.get(`/jobs/${jobId}`);
  return data;
}

export async function downloadAudio(jobId: string): Promise<Blob> {
  const { data } = await api.get(`/jobs/${jobId}/download`, {
    responseType: "blob",
  });
  // ระบุ MIME type ชัดเจน เพื่อให้ WaveSurfer และ Audio element รู้ว่าเป็น WAV
  return new Blob([data], { type: "audio/wav" });
}

// ─────────────────────────────────────────
// Voice Conversion API
// ─────────────────────────────────────────
export async function convertVoice(
  audioFile: File | Blob,
  vcReq: VCRequest
): Promise<{ job_id: string }> {
  const form = new FormData();
  form.append("audio", audioFile, "input.wav");
  form.append("params", JSON.stringify(vcReq));
  const { data } = await api.post("/vc/convert", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ─────────────────────────────────────────
// Models API
// ─────────────────────────────────────────
export async function listModels(): Promise<ModelInfo[]> {
  const { data } = await api.get("/models");
  return data.models;
}

export async function uploadModel(
  file: File,
  type: "tts" | "vc",
  onProgress?: (p: number) => void
): Promise<{ name: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  const { data } = await api.post("/models/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return data;
}

// ─────────────────────────────────────────
// Health check
// ─────────────────────────────────────────
export async function checkHealth(): Promise<{
  status: string;
  engines: Record<string, boolean>;
  gpu: string | null;
}> {
  const { data } = await api.get("/health");
  return data;
}

// ─────────────────────────────────────────
// Polling helper
// ─────────────────────────────────────────
export async function waitForJob(
  jobId: string,
  onProgress?: (status: JobStatus) => void,
  intervalMs = 800
): Promise<JobStatus> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const status = await pollJobStatus(jobId);
        onProgress?.(status);
        if (status.status === "done") {
          clearInterval(interval);
          resolve(status);
        } else if (status.status === "error") {
          clearInterval(interval);
          reject(new Error(status.error || "Job failed"));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, intervalMs);
  });
}
