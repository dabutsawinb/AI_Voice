"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Download } from "lucide-react";

interface WaveformDisplayProps {
  audioUrl: string | null;
  audioBlob?: Blob | null;
  fileName?: string;
}

export default function WaveformDisplay({
  audioUrl,
  audioBlob,
  fileName = "output.wav",
}: WaveformDisplayProps) {
  const audioRef       = useRef<HTMLAudioElement>(null);
  const progressRef    = useRef<HTMLDivElement>(null);
  const objectUrlRef   = useRef<string | null>(null);

  const [isPlaying,   setIsPlaying]   = useState(false);
  const [duration,    setDuration]    = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady,     setIsReady]     = useState(false);
  const [progress,    setProgress]    = useState(0);

  // ── สร้าง Object URL เมื่อ blob เปลี่ยน ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // reset
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setProgress(0);
    audio.pause();

    // revoke ค่าเก่า
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      objectUrlRef.current = url;
      audio.src = url;
      audio.load();
    } else if (audioUrl) {
      audio.src = audioUrl;
      audio.load();
    }

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [audioBlob, audioUrl]);

  // ── Event handlers ──
  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
    setIsReady(true);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    const d = audioRef.current.duration || 1;
    setCurrentTime(t);
    setProgress((t / d) * 100);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const togglePlay = () => {
    if (!audioRef.current || !isReady) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const restart = () => {
    if (!audioRef.current || !isReady) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setProgress(0);
    audioRef.current.play();
    setIsPlaying(true);
  };

  // คลิกที่ progress bar เพื่อ seek
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !isReady) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * audioRef.current.duration;
  };

  const handleDownload = () => {
    if (!audioBlob && !audioUrl) return;
    const url = audioBlob
      ? URL.createObjectURL(audioBlob)
      : audioUrl!;
    const a = document.createElement("a");
    a.href     = url;
    a.download = fileName;
    a.click();
    if (audioBlob) setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Empty state ──
  if (!audioUrl && !audioBlob) {
    return (
      <div className="flex flex-col items-center justify-center h-24 rounded-xl border border-dashed border-[#2a2d3e] text-[#8891b0] text-sm gap-2">
        <div className="flex gap-1 items-end h-8">
          {[20, 40, 60, 80, 55, 35, 70, 45, 30, 65, 50, 25].map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-[#2a2d3e]"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <span>เสียงจะปรากฏที่นี่</span>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1d27] rounded-xl border border-[#2a2d3e] p-4 space-y-3">

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={(e) => console.error("Audio error:", e)}
        preload="auto"
      />

      {/* Fake waveform bars */}
      <div className="flex gap-0.5 items-center h-16 px-1 cursor-pointer" onClick={handleSeek}>
        {Array.from({ length: 60 }).map((_, i) => {
          const heightPct = [
            30,50,70,90,65,45,80,55,35,75,60,40,85,50,30,70,
            90,45,65,80,35,55,75,40,60,85,50,30,70,45,90,65,
            55,80,35,75,40,60,85,50,30,70,45,90,65,80,35,55,
            75,40,60,85,50,30,70,45,90,65,55,80,35,
          ][i] ?? 40;

          const filled = (i / 60) * 100 < progress;

          return (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors duration-100"
              style={{
                height:     `${heightPct}%`,
                background: filled ? "#1a4fff" : "#2a2d3e",
              }}
            />
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            disabled={!isReady}
            className="w-9 h-9 rounded-full bg-[#1a4fff] hover:bg-[#4a7aff] disabled:bg-[#2a2d3e] disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
            style={{ boxShadow: isReady ? "0 0 12px rgba(26,79,255,0.4)" : "none" }}
          >
            {isPlaying
              ? <Pause className="w-4 h-4" />
              : <Play  className="w-4 h-4 ml-0.5" />
            }
          </button>

          {/* Restart */}
          <button
            onClick={restart}
            disabled={!isReady}
            className="w-8 h-8 rounded-full bg-[#222537] hover:bg-[#2a2d3e] disabled:opacity-40 disabled:cursor-not-allowed text-[#8891b0] hover:text-white flex items-center justify-center transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Time */}
          <span className="text-xs text-[#8891b0] font-mono">
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        </div>

        {/* Download */}
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222537] hover:bg-[#2a2d3e] text-[#8891b0] hover:text-white text-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          ดาวน์โหลด
        </button>
      </div>
    </div>
  );
}
