"use client";

import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";
import { Cpu, Wifi, WifiOff } from "lucide-react";

interface HealthState {
  connected: boolean;
  gpu: string | null;
  engines: Record<string, boolean>;
}

export default function StatusBar() {
  const [health, setHealth] = useState<HealthState>({
    connected: false,
    gpu: null,
    engines: {},
  });

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await checkHealth();
        setHealth({
          connected: res.status === "ok",
          gpu: res.gpu,
          engines: res.engines,
        });
      } catch {
        setHealth((h) => ({ ...h, connected: false }));
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-4 text-xs">
      {/* Connection */}
      <div className={`flex items-center gap-1.5 ${health.connected ? "text-emerald-400" : "text-red-400"}`}>
        {health.connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        <span>{health.connected ? "Backend Online" : "Backend Offline"}</span>
      </div>

      {/* GPU */}
      {health.connected && (
        <div className="flex items-center gap-1.5 text-[#8891b0]">
          <Cpu className="w-3.5 h-3.5 text-[#4a7aff]" />
          <span>{health.gpu ? health.gpu.slice(0, 20) : "CPU mode"}</span>
        </div>
      )}

      {/* Engine dots */}
      {health.connected && (
        <div className="flex items-center gap-2">
          {Object.entries(health.engines).map(([name, ok]) => (
            <div key={name} className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="text-[#8891b0] text-[10px]">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
