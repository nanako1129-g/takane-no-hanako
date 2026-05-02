import type { CharacterImageSet } from "@/types";

/**
 * 立ち絵・ヘッダーアバター用の好感度→画像パス（UI仕様）。
 * - affinity >= 70 → happy
 * - affinity >= 40 → baseline
 * - affinity < 40 → cool
 */
export function imageSrcForAffinity(
  images: CharacterImageSet,
  affinity: number
): string {
  if (affinity >= 70) return images.happy;
  if (affinity >= 40) return images.baseline;
  return images.cool;
}
