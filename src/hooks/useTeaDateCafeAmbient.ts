"use client";

import { useVenueLoopAmbient } from "@/hooks/useVenueLoopAmbient";

/**
 * 喫茶デート入室〜退店の環境ループ。
 * `public/audio/tea-date-cafe-bgm.mp3`（星に逢う夜 など）
 */
export function useTeaDateCafeAmbient(active: boolean): void {
  useVenueLoopAmbient(active, {
    src: "/audio/tea-date-cafe-bgm.mp3",
    volume: 0.12,
  });
}
