"use client";

import { useVenueLoopAmbient } from "@/hooks/useVenueLoopAmbient";

const AUDIO_SRC = "/audio/line-chat-ambient.mp3";

/**
 * LINE メイン画面（店シーン／プロポーズ演出以外）で流す控えめなループ
 */
export function useLineChatAmbient(active: boolean): void {
  useVenueLoopAmbient(active, {
    src: AUDIO_SRC,
    volume: 0.068,
  });
}
