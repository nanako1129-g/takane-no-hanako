"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getHeartPhase, getRelationshipLabel } from "@/lib/heartPhase";
import type { AffinityPulse, HeartPhase } from "@/types";

const phaseColor: Record<HeartPhase, string> = {
  idle: "text-gray-400",
  soft: "text-pink-200",
  warm: "text-pink-400",
  beat: "text-pink-500",
  fast: "text-rose-500",
  passion: "text-rose-600",
  intense: "text-red-600",
};

const phaseAnim: Record<HeartPhase, string> = {
  idle: "",
  soft: "animate-heart-soft",
  warm: "animate-heart-warm",
  beat: "animate-heart-beat",
  fast: "animate-heart-fast",
  passion: "animate-heart-passion",
  intense: "animate-heart-intense",
};

type Particle = {
  id: number;
  type: "up" | "down";
  tx: number;
  intensity: number;
};

type Props = {
  affinity: number;
  pulse?: AffinityPulse | null; // 直近の変化を受け取って演出する
};

export function HeartIndicator({ affinity, pulse }: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [pulseAnim, setPulseAnim] = useState<"up" | "down" | null>(null);
  const [showNumber, setShowNumber] = useState(false);
  const phase = getHeartPhase(affinity);
  const label = getRelationshipLabel(affinity);

  useEffect(() => {
    if (!pulse || pulse.delta === 0) return;
    const isUp = pulse.delta > 0;
    setPulseAnim(isUp ? "up" : "down");

    const count = Math.min(
      4,
      Math.max(1, Math.ceil(Math.abs(pulse.delta) / 4))
    );
    const newParticles: Particle[] = Array.from({ length: count }).map(
      (_, i) => ({
        id: pulse.timestamp + i,
        type: isUp ? "up" : "down",
        tx: (Math.random() - 0.5) * 50,
        intensity: Math.abs(pulse.delta),
      })
    );
    setParticles((prev) => [...prev, ...newParticles]);

    const t1 = setTimeout(() => setPulseAnim(null), 600);
    const t2 = setTimeout(() => {
      setParticles((prev) =>
        prev.filter((p) => !newParticles.some((np) => np.id === p.id))
      );
    }, 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // pulse オブジェクトは親で毎回新しい参照になりうるため timestamp+delta で同期
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 上記
  }, [pulse?.timestamp, pulse?.delta]);

  const heartClass = `${phaseColor[phase]} ${
    pulseAnim === "up"
      ? "animate-heart-pulse-up"
      : pulseAnim === "down"
        ? "animate-heart-pulse-down"
        : phaseAnim[phase]
  } transition-colors duration-500`;

  return (
    <div
      className="relative inline-flex select-none flex-col items-center gap-1"
      onMouseEnter={() => setShowNumber(true)}
      onMouseLeave={() => setShowNumber(false)}
    >
      <div className="relative">
        <span
          className={`text-3xl ${heartClass}`}
          aria-label={`好感度 ${affinity}`}
          role="img"
        >
          ❤
        </span>
        {particles.map((p) => (
          <span
            key={p.id}
            className="animate-particle-float pointer-events-none absolute left-1/2 top-0 text-base"
            style={
              {
                "--tx": `${p.tx}px`,
              } as CSSProperties
            }
          >
            {p.type === "up" ? "💕" : "💔"}
          </span>
        ))}
      </div>
      <span className="text-xs tracking-wide text-gray-600">{label}</span>
      {showNumber && (
        <span className="absolute -bottom-5 text-[10px] text-gray-400">
          {affinity}/100
        </span>
      )}
    </div>
  );
}
