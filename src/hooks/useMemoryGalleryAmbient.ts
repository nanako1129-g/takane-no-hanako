"use client";

import { useVenueLoopAmbient } from "@/hooks/useVenueLoopAmbient";

/** 思い出のシーンを振り返るギャラリーで流れる BGM */
export function useMemoryGalleryAmbient(active: boolean): void {
  useVenueLoopAmbient(active, {
    src: "/audio/memory-bgm.mp3",
    volume: 0.18,
  });
}
