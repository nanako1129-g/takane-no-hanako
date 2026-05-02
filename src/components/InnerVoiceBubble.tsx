"use client";

interface InnerVoiceBubbleProps {
  inner: string;
  affinityChange?: number;
  /** バー・沈黙の一拍などで強調表示 */
  variant?: "default" | "silenceReveal";
}

export function InnerVoiceBubble({
  inner,
  affinityChange,
  variant = "default",
}: InnerVoiceBubbleProps) {
  if (!inner) return null;

  const reveal = variant === "silenceReveal";
  const hideAffinityBadge =
    reveal && (!affinityChange || affinityChange === 0);

  const sign = affinityChange !== undefined && affinityChange > 0 ? "+" : "";
  const changeColor =
    affinityChange === undefined || affinityChange === 0
      ? "text-slate-500"
      : affinityChange > 0
        ? "text-rose-600"
        : "text-blue-600";

  return (
    <div
      className={
        reveal
          ? "silence-inner-reveal mt-2 max-w-[85%] rounded-2xl border border-rose-300/70 bg-gradient-to-br from-rose-50/95 via-white to-amber-50/90 px-3 py-2 text-xs text-slate-700 shadow-md ring-1 ring-rose-100/80"
          : "mt-2 max-w-[85%] rounded-2xl border border-slate-200 bg-slate-100/80 px-3 py-2 text-xs text-slate-600 shadow-sm"
      }
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <span aria-hidden>💭</span>
        <span>{reveal ? "ひとときの本心" : "内心"}</span>
        {!hideAffinityBadge && affinityChange !== undefined && (
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
