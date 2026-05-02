"use client";

import { useVenueLoopAmbient } from "@/hooks/useVenueLoopAmbient";

const AUDIO_SRC = "/audio/proposal-bgm.mp3";

/**
 * 💍 メッセージにプロポーズ選択肢が表示されている間（「受ける」「考える」の画面）
 */
export function useProposalMomentAmbient(active: boolean): void {
  useVenueLoopAmbient(active, {
    src: AUDIO_SRC,
    volume: 0.15,
  });
}

/** GOOD ENDING 画面（提案を受諾した直後〜）に同じ曲をひき続ける用 */
export function useProposalEndingAmbient(active: boolean): void {
  useVenueLoopAmbient(active, {
    src: AUDIO_SRC,
    volume: 0.12,
  });
}
