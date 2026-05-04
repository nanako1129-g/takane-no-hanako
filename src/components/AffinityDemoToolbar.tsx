"use client";

export type DemoScene = "tea" | "bar" | "proposal";

type Props = {
  affinity: number;
  initialAffinity: number;
  proposalThreshold?: number;
  onSetAffinity: (value: number) => void;
  onJumpToScene?: (scene: DemoScene) => void;
};

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** ハッカソン／検証用：会話なしで親密度を変更 */
export function AffinityDemoToolbar({
  affinity,
  initialAffinity,
  proposalThreshold = 95,
  onSetAffinity,
  onJumpToScene,
}: Props) {
  const presets = Array.from(
    new Set([
      initialAffinity,
      40,
      60,
      proposalThreshold,
      100,
    ].map((x) => clamp(x)))
  ).sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-amber-200/60 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950 backdrop-blur-sm">
      <span className="font-semibold tracking-wide">開発デモ・親密度</span>
      <label className="flex min-w-[min(100%,12rem)] flex-1 items-center gap-2">
        <span className="shrink-0 text-amber-900/80">調整</span>
        <input
          type="range"
          min={0}
          max={100}
          value={affinity}
          onChange={(e) => onSetAffinity(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer accent-amber-600"
        />
        <span className="w-8 shrink-0 text-right font-mono tabular-nums">
          {affinity}
        </span>
      </label>
      <div className="flex flex-wrap gap-1">
        {presets.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSetAffinity(n)}
            className={`rounded-full border px-2 py-0.5 transition ${
              affinity === n
                ? "border-amber-700 bg-amber-200/90 font-semibold"
                : "border-amber-400/70 bg-white/80 hover:bg-amber-100/80"
            }`}
          >
            {n === initialAffinity ? `初期 (${n})` : String(n)}
          </button>
        ))}
      </div>
      {onJumpToScene && (
        <div className="flex flex-wrap gap-1 border-l border-amber-300/60 pl-3">
          <span className="self-center text-amber-700/70">直行▶</span>
          {(
            [
              { scene: "tea", label: "☕ 喫茶店" },
              { scene: "bar", label: "🍶 居酒屋" },
              { scene: "proposal", label: "💍 プロポーズ" },
            ] as { scene: DemoScene; label: string }[]
          ).map(({ scene, label }) => (
            <button
              key={scene}
              type="button"
              onClick={() => onJumpToScene(scene)}
              className="rounded-full border border-rose-400/70 bg-rose-50/80 px-2 py-0.5 transition hover:bg-rose-100/80"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
