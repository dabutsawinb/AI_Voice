"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Mic, MicOff, Upload, X, RefreshCw, Loader2,
  ChevronDown, Wand2, Info
} from "lucide-react";
import {
  convertVoice, waitForJob, downloadAudio,
  listModels, type VCRequest, type ModelInfo, type JobStatus,
} from "@/lib/api";
import WaveformDisplay from "./WaveformDisplay";

type InputMode = "upload" | "record";

export default function VCPanel() {
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [inputAudio, setInputAudio] = useState<File | Blob | null>(null);
  const [inputAudioName, setInputAudioName] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState("default");
  const [pitchShift, setPitchShift] = useState(0);
  const [indexRate, setIndexRate] = useState(0.75);
  const [filterRadius, setFilterRadius] = useState(3);
  const [rmsMixRate, setRmsMixRate] = useState(0.25);
  const [protect, setProtect] = useState(0.33);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listModels()
      .then((m) => {
        const vcModels = m.filter((x) => x.type === "vc");
        setModels(vcModels);
        if (vcModels.length > 0) setSelectedModel(vcModels[0].name);
      })
      .catch(() => {});
  }, []);

  // ─── Recording ───
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recordedChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        setInputAudio(blob);
        setInputAudioName(`recording-${Date.now()}.webm`);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตสิทธิ์");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("กรุณาเลือกไฟล์เสียงเท่านั้น");
      return;
    }
    setInputAudio(file);
    setInputAudioName(file.name);
  };

  const clearInput = () => {
    setInputAudio(null);
    setInputAudioName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConvert = async () => {
    if (!inputAudio) {
      toast.error("กรุณาอัปโหลดหรืออัดเสียงก่อน");
      return;
    }
    if (!selectedModel || selectedModel === "default") {
      toast.error("กรุณาเลือก RVC Model ก่อน");
      return;
    }

    setIsLoading(true);
    setOutputBlob(null);
    setStatus(null);

    try {
      const vcReq: VCRequest = {
        model_name: selectedModel,
        pitch_shift: pitchShift,
        index_rate: indexRate,
        filter_radius: filterRadius,
        rms_mix_rate: rmsMixRate,
        protect,
      };

      const { job_id } = await convertVoice(inputAudio, vcReq);
      toast.info("กำลังแปลงเสียง...", { id: "vc-job" });

      const finalStatus = await waitForJob(job_id, (s) => setStatus(s));
      toast.success("แปลงเสียงสำเร็จ!", { id: "vc-job" });

      const blob = await downloadAudio(job_id);
      setOutputBlob(blob);
      setStatus(finalStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(msg, { id: "vc-job" });
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* ─── LEFT: INPUT ─── */}
      <div className="xl:col-span-3 space-y-5">
        {/* Mode tabs */}
        <div className="bg-[#1a1d27] rounded-2xl border border-[#2a2d3e] p-5">
          <div className="flex gap-2 mb-5">
            {(["upload", "record"] as InputMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setInputMode(m); clearInput(); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  inputMode === m
                    ? "bg-[#7c3aed]/20 border border-[#7c3aed] text-[#a78bfa]"
                    : "bg-[#0f1117] border border-[#2a2d3e] text-[#8891b0] hover:border-[#4a5068]"
                }`}
              >
                {m === "upload" ? <Upload className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {m === "upload" ? "อัปโหลดไฟล์" : "อัดเสียงสด"}
              </button>
            ))}
          </div>

          {/* Upload mode */}
          {inputMode === "upload" && (
            <>
              {inputAudio ? (
                <div className="flex items-center justify-between bg-[#0f1117] rounded-xl border border-[#2a2d3e] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#7c3aed]/20 flex items-center justify-center">
                      <Upload className="w-4 h-4 text-[#a78bfa]" />
                    </div>
                    <div>
                      <p className="text-sm text-white truncate max-w-xs">{inputAudioName}</p>
                      <p className="text-xs text-[#8891b0]">
                        {inputAudio instanceof File
                          ? `${(inputAudio.size / 1024).toFixed(0)} KB`
                          : "Recorded audio"}
                      </p>
                    </div>
                  </div>
                  <button onClick={clearInput} className="text-[#8891b0] hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed border-[#2a2d3e] hover:border-[#7c3aed]/50 hover:bg-[#7c3aed]/5 text-[#8891b0] hover:text-[#a78bfa] transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-full bg-[#2a2d3e] group-hover:bg-[#7c3aed]/20 flex items-center justify-center transition-colors">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">คลิกเพื่ออัปโหลดเสียง</p>
                    <p className="text-xs mt-1">.wav · .mp3 · .flac · .ogg (สูงสุด 50MB)</p>
                  </div>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </>
          )}

          {/* Record mode */}
          {inputMode === "record" && (
            <div className="flex flex-col items-center py-8 gap-5">
              {/* Mic button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!!inputAudio && !isRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 recording-pulse shadow-lg shadow-red-500/40"
                    : inputAudio
                    ? "bg-emerald-500 cursor-default"
                    : "bg-[#7c3aed] hover:bg-[#6d28d9] shadow-lg shadow-[#7c3aed]/40"
                }`}
              >
                {isRecording ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
              </button>

              {isRecording && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-1 items-end h-8">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 rounded-full bg-red-400 eq-bar-${i + 1}`}
                        style={{ minHeight: "6px" }}
                      />
                    ))}
                  </div>
                  <span className="text-red-400 font-mono font-bold">{fmt(recordSeconds)}</span>
                  <span className="text-xs text-[#8891b0]">กำลังบันทึก... กดอีกครั้งเพื่อหยุด</span>
                </div>
              )}

              {!isRecording && inputAudio && (
                <div className="text-center">
                  <p className="text-emerald-400 font-medium text-sm">บันทึกเสร็จแล้ว</p>
                  <p className="text-xs text-[#8891b0] mt-1">{fmt(recordSeconds)} วินาที</p>
                  <button
                    onClick={clearInput}
                    className="mt-3 flex items-center gap-1.5 text-xs text-[#8891b0] hover:text-white transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    อัดใหม่
                  </button>
                </div>
              )}

              {!isRecording && !inputAudio && (
                <div className="text-center">
                  <p className="text-sm text-[#8891b0]">กดปุ่มเพื่อเริ่มอัดเสียง</p>
                  <p className="text-xs text-[#4a5068] mt-1">ต้องการสิทธิ์เข้าถึงไมโครโฟน</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input waveform preview */}
        {inputAudio && (
          <div>
            <p className="text-xs text-[#8891b0] mb-2 font-medium">ตัวอย่างเสียง Input</p>
            <WaveformDisplay
              audioBlob={inputAudio instanceof Blob ? inputAudio : undefined}
              audioUrl={inputAudio instanceof File ? URL.createObjectURL(inputAudio) : null}
              fileName={inputAudioName}
            />
          </div>
        )}
      </div>

      {/* ─── RIGHT: SETTINGS + OUTPUT ─── */}
      <div className="xl:col-span-2 space-y-5">
        {/* RVC Settings */}
        <div className="bg-[#1a1d27] rounded-2xl border border-[#2a2d3e] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">RVC v2 Settings</h3>

          {/* Model selection */}
          <div>
            <label className="block text-xs text-[#8891b0] mb-2">Voice Model (.pth)</label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full appearance-none bg-[#0f1117] text-white text-sm rounded-lg border border-[#2a2d3e] focus:border-[#7c3aed] focus:outline-none px-3 py-2 pr-8 transition-colors"
              >
                <option value="default">-- เลือก RVC Model --</option>
                {models.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-[#8891b0] pointer-events-none" />
            </div>
            {models.length === 0 && (
              <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                <Info className="w-3 h-3" />
                ยังไม่มี RVC Model — วางไฟล์ .pth ใน /backend/models/rvc/
              </p>
            )}
          </div>

          {/* Pitch Shift */}
          <div>
            <label className="block text-xs text-[#8891b0] mb-2">
              Pitch Shift: <span className="text-white">{pitchShift > 0 ? "+" : ""}{pitchShift} semitones</span>
            </label>
            <input
              type="range" min="-24" max="24" step="1"
              value={pitchShift}
              onChange={(e) => setPitchShift(parseInt(e.target.value))}
              className="w-full accent-[#7c3aed]"
            />
            <div className="flex justify-between text-[10px] text-[#4a5068] mt-0.5">
              <span>-24</span><span>0</span><span>+24</span>
            </div>
          </div>

          {/* Index Rate */}
          <div>
            <label className="block text-xs text-[#8891b0] mb-2">
              Index Rate: <span className="text-white">{indexRate.toFixed(2)}</span>
              <span className="text-[#4a5068] ml-1">(ความแม่นของเสียง)</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.01"
              value={indexRate}
              onChange={(e) => setIndexRate(parseFloat(e.target.value))}
              className="w-full accent-[#7c3aed]"
            />
          </div>

          {/* Filter Radius */}
          <div>
            <label className="block text-xs text-[#8891b0] mb-2">
              Filter Radius: <span className="text-white">{filterRadius}</span>
              <span className="text-[#4a5068] ml-1">(ลด breathiness)</span>
            </label>
            <input
              type="range" min="0" max="7" step="1"
              value={filterRadius}
              onChange={(e) => setFilterRadius(parseInt(e.target.value))}
              className="w-full accent-[#7c3aed]"
            />
          </div>

          {/* Protect */}
          <div>
            <label className="block text-xs text-[#8891b0] mb-2">
              Protect: <span className="text-white">{protect.toFixed(2)}</span>
              <span className="text-[#4a5068] ml-1">(ป้องกัน artifact)</span>
            </label>
            <input
              type="range" min="0" max="0.5" step="0.01"
              value={protect}
              onChange={(e) => setProtect(parseFloat(e.target.value))}
              className="w-full accent-[#7c3aed]"
            />
          </div>
        </div>

        {/* Convert Button */}
        <button
          onClick={handleConvert}
          disabled={isLoading || !inputAudio || !selectedModel || selectedModel === "default"}
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed disabled:opacity-50 bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] hover:from-[#6d28d9] hover:to-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/30"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังแปลงเสียง... ({status?.progress ?? 0}%)
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              แปลงเสียง
            </>
          )}
        </button>

        {/* Progress */}
        {isLoading && status && (
          <div className="h-1.5 bg-[#2a2d3e] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] transition-all duration-500 rounded-full"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        )}

        {/* Output */}
        <WaveformDisplay audioBlob={outputBlob} fileName="vc-output.wav" audioUrl={null} />

        {/* Stats */}
        {status?.status === "done" && (
          <div className="flex gap-3 text-xs">
            <div className="flex-1 bg-[#1a1d27] rounded-xl border border-[#2a2d3e] px-3 py-2 text-center">
              <p className="text-[#8891b0]">Model</p>
              <p className="text-white font-medium mt-0.5 truncate">{selectedModel}</p>
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
