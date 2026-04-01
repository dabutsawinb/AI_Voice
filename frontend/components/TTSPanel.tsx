"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";
import {
  synthesizeSpeech,
  waitForJob,
  downloadAudio,
  listModels,
  type TTSRequest,
  type ModelInfo,
  type JobStatus,
} from "@/lib/api";

import WaveformDisplay from "./WaveformDisplay";

const LANGUAGES = [
  { value: "th", label: "ภาษาไทย" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
];

export default function TTSPanel() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("th");
  const [voiceId, setVoiceId] = useState("default");
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  useEffect(() => {
    listModels()
      .then((m) => setModels(m.filter((x) => x.type === "tts")))
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error("กรุณาพิมพ์ข้อความก่อน");
      return;
    }
    setIsLoading(true);
    setOutputBlob(null);
    setStatus(null);

    try {
      const req: TTSRequest = {
        text: text.trim(),
        voice_id: voiceId,
        engine: "edge_tts",
        language,
        speed,
        pitch,
      };

      const { job_id } = await synthesizeSpeech(req);
      toast.info("กำลังประมวลผล...", { id: "tts-job" });

      const finalStatus = await waitForJob(job_id, (s) => setStatus(s));
      toast.success("สร้างเสียงสำเร็จ!", { id: "tts-job" });

      const blob = await downloadAudio(job_id);
      setOutputBlob(blob);
      setStatus(finalStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(msg, { id: "tts-job" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* ─── LEFT: INPUT ─── */}
      <div className="xl:col-span-3 space-y-5">
        {/* Text Input */}
        <div className="bg-[#1a1d27] rounded-2xl border border-[#2a2d3e] p-5">
          <label className="block text-sm font-semibold text-white mb-3">
            ข้อความที่ต้องการอ่าน
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="พิมพ์ข้อความที่ต้องการสังเคราะห์เป็นเสียงที่นี่..."
            rows={6}
            maxLength={2000}
            className="w-full bg-[#0f1117] text-white placeholder-[#4a5068] rounded-xl border border-[#2a2d3e] focus:border-[#1a4fff] focus:outline-none focus:ring-1 focus:ring-[#1a4fff]/50 p-4 text-sm resize-none transition-colors"
          />
          <div className="flex justify-end mt-2">
            <span className="text-xs text-[#8891b0]">{text.length} / 2000</span>
          </div>
        </div>

      </div>

      {/* ─── RIGHT: SETTINGS + OUTPUT ─── */}
      <div className="xl:col-span-2 space-y-5">
        {/* Settings */}
        <div className="bg-[#1a1d27] rounded-2xl border border-[#2a2d3e] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">ตั้งค่า</h3>

          {/* Engine Badge */}
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[#1a4fff]/10 border border-[#1a4fff]/30">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-[#4a7aff]">Edge TTS</span>
            <span className="text-[10px] text-[#4a5068] ml-auto">Microsoft Neural TTS</span>
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs text-[#8891b0] mb-2">ภาษา</label>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full appearance-none bg-[#0f1117] text-white text-sm rounded-lg border border-[#2a2d3e] focus:border-[#1a4fff] focus:outline-none px-3 py-2 pr-8 transition-colors"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-[#8891b0] pointer-events-none" />
            </div>
          </div>

          {/* Voice Model */}
          <div>
            <label className="block text-xs text-[#8891b0] mb-2">Voice Model</label>
            <div className="relative">
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full appearance-none bg-[#0f1117] text-white text-sm rounded-lg border border-[#2a2d3e] focus:border-[#1a4fff] focus:outline-none px-3 py-2 pr-8 transition-colors"
              >
                <option value="default">Default</option>
                {models.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-[#8891b0] pointer-events-none" />
            </div>
          </div>

          {/* Speed */}
          <div>
            <label className="block text-xs text-[#8891b0] mb-2">
              ความเร็ว: <span className="text-white">{speed.toFixed(1)}x</span>
            </label>
            <input
              type="range" min="0.5" max="2.0" step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-[#1a4fff]"
            />
            <div className="flex justify-between text-[10px] text-[#4a5068] mt-0.5">
              <span>0.5x</span><span>1.0x</span><span>2.0x</span>
            </div>
          </div>

          {/* Pitch */}
          <div>
            <label className="block text-xs text-[#8891b0] mb-2">
              Pitch: <span className="text-white">{pitch > 0 ? "+" : ""}{pitch} semitones</span>
            </label>
            <input
              type="range" min="-12" max="12" step="1"
              value={pitch}
              onChange={(e) => setPitch(parseInt(e.target.value))}
              className="w-full accent-[#1a4fff]"
            />
            <div className="flex justify-between text-[10px] text-[#4a5068] mt-0.5">
              <span>-12</span><span>0</span><span>+12</span>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isLoading || !text.trim()}
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all btn-glow disabled:cursor-not-allowed disabled:opacity-50 bg-gradient-to-r from-[#1a4fff] to-[#4a7aff] hover:from-[#0033e6] hover:to-[#1a4fff] text-white shadow-lg shadow-[#1a4fff]/30"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังสร้างเสียง... ({status?.progress ?? 0}%)
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              สร้างเสียง
            </>
          )}
        </button>

        {/* Progress bar */}
        {isLoading && status && (
          <div className="h-1.5 bg-[#2a2d3e] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#1a4fff] to-[#4a7aff] transition-all duration-500 rounded-full"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        )}

        {/* Output Waveform */}
        <WaveformDisplay audioBlob={outputBlob} fileName="tts-output.wav" audioUrl={null} />

        {/* Stats */}
        {status?.status === "done" && (
          <div className="flex gap-3 text-xs">
            <div className="flex-1 bg-[#1a1d27] rounded-xl border border-[#2a2d3e] px-3 py-2 text-center">
              <p className="text-[#8891b0]">Engine</p>
              <p className="text-white font-medium mt-0.5">{status.engine_used ?? "—"}</p>
            </div>
            <div className="flex-1 bg-[#1a1d27] rounded-xl border border-[#2a2d3e] px-3 py-2 text-center">
              <p className="text-[#8891b0]">เวลา</p>
              <p className="text-white font-medium mt-0.5">
                {status.duration_ms ? `${(status.duration_ms / 1000).toFixed(1)}s` : "—"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
