"use client";

import { useVenueLoopAmbient } from "@/hooks/useVenueLoopAmbient";

/**
 * Bar Polaris 入室〜退室の環境ループ。
 * `public/audio/bar-polaris-jazz-loop.mp3`
 */
export function useBarPolarisAmbient(active: boolean): void {
  useVenueLoopAmbient(active, {
    src: "/audio/bar-polaris-jazz-loop.mp3",
    volume: 0.14,
  });
}
