"use client";

interface InnerVoiceBubbleProps {
  inner: string;
  affinityChange?: number;
}

export function InnerVoiceBubble({ inner, affinityChange }: InnerVoiceBubbleProps) {
  if (!inner) return null;

  const sign = affinityChange !== undefined && affinityChange > 0 ? "+" : "";
  const changeColor =
    affinityChange === undefined || affinityChange === 0
      ? "text-slate-500"
      : affinityChange > 0
        ? "text-rose-600"
        : "text-blue-600";

  return (
    <div className="mt-2 max-w-[85%] rounded-2xl border border-slate-200 bg-slate-100/80 px-3 py-2 text-xs text-slate-600 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <span aria-hidden>💭</span>
        <span>内心</span>
        {affinityChange !== undefined && (
          <span className={`ml-auto font-mono ${changeColor}`}>
            好感度 {sign}
            {affinityChange}
          </span>
        )}
      </div>
      <p className="mt-1 leading-relaxed">{inner}</p>
    </div>
  );
}
