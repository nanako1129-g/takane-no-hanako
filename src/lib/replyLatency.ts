import type { Character } from "@/types";

export function sleepMs(ms: number): Promise<void> {
  const dur = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  return new Promise((resolve) => setTimeout(resolve, dur));
}

function uniformInclusive(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= lo) return Math.round(lo);
  return lo + Math.random() * (hi - lo);
}

/**
 * 好感度ごとに「考えている時間」のばらつきバンドをずらす（全体は `[globalMinMs,globalMaxMs]` に収める）
 */
export function typingDelayRandomMsAffinity(
  affinity: number,
  globalMinMs: number,
  globalMaxMs: number
): number {
  const gmin = Number.isFinite(globalMinMs)
    ? globalMinMs
    : 500;
  const gmax = Number.isFinite(globalMaxMs)
    ? globalMaxMs
    : 1500;
  const span = gmax - gmin;
  const a =
    typeof affinity === "number" && Number.isFinite(affinity)
      ? Math.max(0, Math.min(100, affinity))
      : 50;

  if (span <= 0) return Math.round(Math.min(gmin, gmax));

  let loBand = gmin;
  let hiBand = gmax;

  if (a < 70) {
    hiBand = gmin + span * 0.55;
  } else if (a < 85) {
    loBand = gmin + span * 0.12;
    hiBand = gmin + span * 0.92;
  } else {
    loBand = gmin + span * 0.22;
    hiBand = gmax;
  }

  return Math.round(uniformInclusive(loBand, hiBand));
}

/** キャラが `assistantReplyDelayMinMs` / `MaxMs` を持つときのみ遅延（ms）。未設定は 0。 */
export function assistantTypingDelayMs(
  character: Character,
  affinity: number
): number {
  const mn = character.assistantReplyDelayMinMs;
  const mx = character.assistantReplyDelayMaxMs;
  if (typeof mn !== "number" || typeof mx !== "number") return 0;
  return typingDelayRandomMsAffinity(affinity, mn, mx);
}
