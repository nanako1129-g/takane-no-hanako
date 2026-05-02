import type { HeartPhase } from "@/types";

export function getHeartPhase(affinity: number): HeartPhase {
  if (affinity >= 95) return "intense";
  if (affinity >= 85) return "passion";
  if (affinity >= 75) return "fast";
  if (affinity >= 60) return "beat";
  if (affinity >= 40) return "warm";
  if (affinity >= 20) return "soft";
  return "idle";
}

export function getRelationshipLabel(affinity: number): string {
  if (affinity >= 95) return "運命？";
  if (affinity >= 85) return "ドキドキ";
  if (affinity >= 75) return "好意";
  if (affinity >= 60) return "親しい";
  if (affinity >= 40) return "打ち解けはじめ";
  if (affinity >= 20) return "様子見";
  return "警戒中";
}
