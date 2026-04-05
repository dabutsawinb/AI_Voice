"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Upload, FileVideo, FileAudio, Loader2, CheckCircle2,
  Mic, Clock, Users, Sparkles, ChevronDown, ChevronUp,
  ListChecks, Lightbulb, Tag, AlignLeft,
} from "lucide-react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ───────────────────────────────────────────────────
interface Utterance {
  speaker:  string;
  text:     string;
  start_ms: number;
  end_ms:   number;
}

interface NoteResult {
  job_id:       string;
  status:       "queued" | "processing" | "done" | "error";
  progress:     number;
  full_text?:   string;
  utterances?:  Utterance[];
  duration_sec?: number;
  language?:    string;
  summary?:     string;
  key_points?:  string[];
  action_items?: string[];
  topics?:      string[];
  error?:       string;
  engine_used?: string;
}

// ─── Helpers ─────────────────────────────────────────────────
const SPEAKER_COLORS = [
  "text-[#4a7aff] bg-[#4a7aff]/10 border-[#4a7aff]/30",
  "text-[#a78bfa] bg-[#a78bfa]/10 border-[#a78bfa]/30",
  "text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30",
  "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/30",
  "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/30",
];

function msToTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h   = Math.floor(totalSec / 3600);
  const m   = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function msToRange(startMs: number, endMs: number) {
  return `${msToTime(startMs)} - ${msToTime(endMs)}`;
}

function speakerColor(speaker: string) {
  const idx = speaker.charCodeAt(speaker.length - 1) % SPEAKER_COLORS.length;
  return SPEAKER_COLORS[idx];
}

// ─── Sub-components ──────────────────────────────────────────

function SummaryCard({ result }: { result: NoteResult }) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      {result.summary && (
        <div className="bg-[#1a1d27] rounded-2xl border border-[#2a2d3e] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlignLeft className="w-4 h-4 text-[#4a7aff]" />
            <h3 className="text-sm font-semibold text-white">สรุปภาพรวม</h3>
          </div>
          <p className="text-sm text-[#c5cae5] leading-relaxed">{result.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Points */}
        {result.key_points && result.key_points.length > 0 && (
          <div className="bg-[#1a1d27] rounded-2xl border border-[#2a2d3e] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-[#fbbf24]" />
              <h3 className="text-sm font-semibold text-white">ประเด็นสำคัญ</h3>
            </div>
            <ul className="space-y-2">
              {result.key_points.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#c5cae5]">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#fbbf24] flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items */}
        {result.action_items && result.action_items.length > 0 && (
          <div className="bg-[#1a1d27] rounded-2xl border border-[#34d399]/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-4 h-4 text-[#34d399]" />
              <h3 className="text-sm font-semibold text-white">Action Items</h3>
            </div>
            <ul className="space-y-2">
              {result.action_items.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#c5cae5]">
                  <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border border-[#34d399]/50 flex items-center justify-center text-[10px] text-[#34d399] font-bold">
                    {i + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Topics */}
      {result.topics && result.topics.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-3.5 h-3.5 text-[#8891b0]" />
          {result.topics.map((t, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-[#22253a] border border-[#2a2d3e] text-[#8891b0]">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TranscriptView({ utterances, fullText }: { utterances?: Utterance[]; fullText?: string }) {
  const [expanded, setExpanded] = useState(true);

  if (!utterances?.length && !fullText) return null;

  return (
    <div className="bg-[#1a1d27] rounded-2xl border border-[#2a2d3e]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-[#4a7aff]" />
          <h3 className="text-sm font-semibold text-white">Transcript</h3>
          {utterances?.length && (
            <span className="text-xs text-[#8891b0] bg-[#22253a] px-2 py-0.5 rounded-full">
              {utterances.length} ช่วง
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#8891b0]" /> : <ChevronDown className="w-4 h-4 text-[#8891b0]" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3 max-h-[500px] overflow-y-auto">
          {utterances?.length ? (
            utterances.map((u, i) => (
              <div key={i} className="group flex gap-3 py-2 border-b border-[#1e2133] last:border-0">
                {/* Speaker color bar */}
                <div className={`w-1 rounded-full flex-shrink-0 ${speakerColor(u.speaker).split(" ")[0].replace("text-", "bg-")}`} />

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Timestamp + Speaker badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-[#4a5068] bg-[#0f1117] px-2 py-0.5 rounded">
                      [{msToRange(u.start_ms, u.end_ms)}]
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${speakerColor(u.speaker)}`}>
                      Speaker {u.speaker}
                    </span>
                  </div>
                  {/* Text */}
                  <p className="text-sm text-[#c5cae5] leading-relaxed">
                    &ldquo;{u.text}&rdquo;
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[#c5cae5] leading-relaxed whitespace-pre-wrap">{fullText}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function NotesPanel() {
  const [file, setFile]         = useState<File | null>(null);
  const [language, setLanguage] = useState("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState<NoteResult | null>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const LANGUAGES = [
    { value: "auto", label: "ตรวจอัตโนมัติ" },
    { value: "th",   label: "ภาษาไทย" },
    { value: "en",   label: "English" },
    { value: "zh",   label: "中文" },
    { value: "ja",   label: "日本語" },
  ];

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleProcess = async () => {
    if (!file) { toast.error("กรุณาเลือกไฟล์ก่อน"); return; }
    setIsLoading(true);
    setResult(null);
    setProgress(0);

    try {
      // 1. Upload file
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await axios.post(
        `${API}/notes/transcribe?language=${language}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const { job_id } = uploadRes.data;
      toast.info("กำลังถอดเทป...", { id: "note-job" });

      // 2. Poll จนเสร็จ
      while (true) {
        await new Promise(r => setTimeout(r, 2500));
        const res = await axios.get(`${API}/notes/result/${job_id}`);
        const data: NoteResult = res.data;
        setProgress(data.progress);

        if (data.status === "done") {
          setResult(data);
          toast.success("เสร็จแล้ว!", { id: "note-job" });
          break;
        } else if (data.status === "error") {
          throw new Error(data.error ?? "เกิดข้อผิดพลาด");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(msg, { id: "note-job" });
    } finally {
      setIsLoading(false);
    }
  };

  const isVideo = file?.type.startsWith("video/");
  const sizeMB  = file ? (file.size / 1024 / 1024).toFixed(1) : null;

  return (
    <div className="space-y-6">
      {/* ─── Upload Zone ─── */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => !file && fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer
          ${file
            ? "border-[#4a7aff]/50 bg-[#1a4fff]/5"
            : "border-[#2a2d3e] hover:border-[#4a7aff]/50 hover:bg-[#1a4fff]/5 bg-[#1a1d27]"
          }`}
      >
        <div className="p-8 flex flex-col items-center gap-3 text-center">
          {file ? (
            <>
              {isVideo
                ? <FileVideo className="w-10 h-10 text-[#4a7aff]" />
                : <FileAudio className="w-10 h-10 text-[#4a7aff]" />
              }
              <div>
                <p className="font-semibold text-white">{file.name}</p>
                <p className="text-sm text-[#8891b0]">{sizeMB} MB · {file.type || "unknown"}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }}
                className="text-xs text-[#8891b0] hover:text-red-400 underline"
              >
                เปลี่ยนไฟล์
              </button>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-[#1a4fff]/10 border border-[#1a4fff]/20 flex items-center justify-center">
                <Upload className="w-6 h-6 text-[#4a7aff]" />
              </div>
              <div>
                <p className="font-semibold text-white">ลากไฟล์มาวางหรือคลิกเพื่อเลือก</p>
                <p className="text-sm text-[#8891b0] mt-1">รองรับ .mp4 .mp3 .wav .flac .webm (สูงสุด 500 MB)</p>
              </div>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
        />
      </div>

      {/* ─── Settings + Button ─── */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-[#8891b0] mb-2">ภาษาในไฟล์</label>
          <div className="relative">
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full appearance-none bg-[#1a1d27] text-white text-sm rounded-xl border border-[#2a2d3e] focus:border-[#1a4fff] focus:outline-none px-4 py-2.5 pr-8 transition-colors"
            >
              {LANGUAGES.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-[#8891b0] pointer-events-none" />
          </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={isLoading || !file}
          className="flex-1 min-w-[200px] py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] hover:from-[#6d28d9] hover:to-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/30"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />กำลังประมวลผล... {progress}%</>
          ) : (
            <><Sparkles className="w-4 h-4" />ถอดเทป + สรุป</>
          )}
        </button>
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <div className="space-y-2">
          <div className="h-1.5 bg-[#2a2d3e] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] transition-all duration-700 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[#8891b0] text-center">
            {progress < 20 ? "กำลังอัปโหลดไฟล์..."
              : progress < 75 ? "AssemblyAI กำลังถอดเทป..."
              : progress < 95 ? "Gemini กำลังสรุปเนื้อหา..."
              : "เกือบเสร็จแล้ว..."}
          </p>
        </div>
      )}

      {/* ─── Results ─── */}
      {result?.status === "done" && (
        <div className="space-y-5">
          {/* Meta Bar */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-[#1a1d27] rounded-2xl border border-[#2a2d3e]">
            <div className="flex items-center gap-1.5 text-xs text-[#8891b0]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">ถอดเทปสำเร็จ</span>
            </div>
            {result.duration_sec && (
              <div className="flex items-center gap-1.5 text-xs text-[#8891b0]">
                <Clock className="w-3.5 h-3.5" />
                <span>{Math.floor(result.duration_sec / 60)} นาที {Math.floor(result.duration_sec % 60)} วินาที</span>
              </div>
            )}
            {result.utterances && (
              <div className="flex items-center gap-1.5 text-xs text-[#8891b0]">
                <Users className="w-3.5 h-3.5" />
                <span>{new Set(result.utterances.map(u => u.speaker)).size} คนพูด</span>
              </div>
            )}
            {result.language && (
              <span className="ml-auto text-xs bg-[#22253a] border border-[#2a2d3e] px-2 py-0.5 rounded-full text-[#8891b0]">
                {result.language.toUpperCase()}
              </span>
            )}
          </div>

          {/* Summary Section */}
          <SummaryCard result={result} />

          {/* Transcript */}
          <TranscriptView utterances={result.utterances} fullText={result.full_text} />
        </div>
      )}

      {/* Error */}
      {result?.status === "error" && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          ❌ {result.error}
        </div>
      )}
    </div>
  );
}
