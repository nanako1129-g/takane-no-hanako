"use client";

interface AffinityBarProps {
  value: number;
  label?: string;
}

function affinityLabel(value: number): { text: string; color: string } {
  if (value >= 80) return { text: "深い信頼", color: "text-rose-600" };
  if (value >= 60) return { text: "好印象", color: "text-pink-600" };
  if (value >= 40) return { text: "様子見", color: "text-slate-600" };
  if (value >= 20) return { text: "微妙…", color: "text-amber-600" };
  return { text: "氷点下", color: "text-blue-600" };
}

export function AffinityBar({ value, label = "好感度" }: AffinityBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const status = affinityLabel(clamped);

  return (
    <div className="w-full rounded-2xl border border-rose-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between text-xs font-medium text-slate-600">
        <span className="flex items-center gap-1.5">
          <span aria-hidden>♡</span>
          <span>{label}</span>
        </span>
        <span className={`font-semibold ${status.color}`}>
          {clamped} / 100 ・ {status.text}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-rose-50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-pink-400 via-rose-400 to-rose-500 transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clamped}
        />
      </div>
    </div>
  );
}
