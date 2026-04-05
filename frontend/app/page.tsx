"use client";

import { useState } from "react";
import { Cpu, Mic, Volume2, Zap, FileText } from "lucide-react";
import TTSPanel from "@/components/TTSPanel";
import VCPanel from "@/components/VCPanel";
import NotesPanel from "@/components/NotesPanel";
import StatusBar from "@/components/StatusBar";

type Mode = "tts" | "vc" | "notes";

export default function Home() {
  const [activeMode, setActiveMode] = useState<Mode>("tts");

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      {/* ===== HEADER ===== */}
      <header className="border-b border-[#2a2d3e] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a4fff] to-[#a78bfa] flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">
                AI Voice Studio
              </h1>
              <p className="text-xs text-[#8891b0] mt-0.5">
                Synthesis & Transformation System
              </p>
            </div>
          </div>

          {/* Status Bar */}
          <StatusBar />
        </div>
      </header>

      {/* ===== HERO ===== */}
      <div className="border-b border-[#2a2d3e] bg-gradient-to-b from-[#1a1d27] to-[#0f1117]">
        <div className="max-w-7xl mx-auto px-6 py-10 text-center">
          <div className="inline-flex items-center gap-2 bg-[#1a4fff]/10 border border-[#1a4fff]/30 rounded-full px-4 py-1.5 mb-4">
            <Cpu className="w-3.5 h-3.5 text-[#4a7aff]" />
            <span className="text-xs text-[#4a7aff] font-medium">
              Powered by RVC v2 + Edge TTS + AssemblyAI
            </span>
          </div>
          <h2 className="text-4xl font-extrabold gradient-text mb-3">
            สร้างและแปลงเสียงด้วย AI
          </h2>
          <p className="text-[#8891b0] text-base max-w-xl mx-auto">
            สังเคราะห์เสียงพูดจากข้อความ หรือแปลงเสียงของคุณเป็นเสียงตัวละครที่ต้องการ
            ด้วยเทคโนโลยี Deep Learning ล่าสุด
          </p>
        </div>
      </div>

      {/* ===== MODE TABS ===== */}
      <div className="max-w-7xl mx-auto w-full px-6 pt-8">
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveMode("tts")}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
              activeMode === "tts"
                ? "bg-[#1a4fff] text-white shadow-lg shadow-[#1a4fff]/30 btn-glow"
                : "bg-[#1a1d27] text-[#8891b0] border border-[#2a2d3e] hover:bg-[#222537] hover:text-white"
            }`}
          >
            <Volume2 className="w-4 h-4" />
            Text-to-Speech
            <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${
              activeMode === "tts"
                ? "bg-white/20 text-white"
                : "bg-[#2a2d3e] text-[#8891b0]"
            }`}>
              TTS
            </span>
          </button>

          <button
            onClick={() => setActiveMode("vc")}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
              activeMode === "vc"
                ? "bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white shadow-lg shadow-[#7c3aed]/30"
                : "bg-[#1a1d27] text-[#8891b0] border border-[#2a2d3e] hover:bg-[#222537] hover:text-white"
            }`}
          >
            <Mic className="w-4 h-4" />
            Voice Conversion
            <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${
              activeMode === "vc"
                ? "bg-white/20 text-white"
                : "bg-[#2a2d3e] text-[#8891b0]"
            }`}>
              VC
            </span>
          </button>

          <button
            onClick={() => setActiveMode("notes")}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
              activeMode === "notes"
                ? "bg-gradient-to-r from-[#0e7490] to-[#22d3ee] text-white shadow-lg shadow-[#0e7490]/30"
                : "bg-[#1a1d27] text-[#8891b0] border border-[#2a2d3e] hover:bg-[#222537] hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            Smart Note
            <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${
              activeMode === "notes"
                ? "bg-white/20 text-white"
                : "bg-[#2a2d3e] text-[#8891b0]"
            }`}>
              NEW
            </span>
          </button>
        </div>

        {/* ===== PANELS ===== */}
        <div className="pb-12">
          {activeMode === "tts" && <TTSPanel />}
          {activeMode === "vc"  && <VCPanel />}
          {activeMode === "notes" && <NotesPanel />}
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t border-[#2a2d3e] py-4 px-6 text-center text-xs text-[#8891b0]">
        AI Voice Studio — RVC v2 · Edge TTS · AssemblyAI · Gemini 1.5 Flash
      </footer>
    </div>
  );
}
