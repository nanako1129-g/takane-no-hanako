"use client";

import { useEffect, useRef } from "react";

const TICK_MS = 1000;

export type CompanionSilencePingArgs = {
  enabled: boolean;
  paused: boolean;
  silenceMs?: number;
  /** ログ末尾がキャラ側なら true（ユーザー無言カウントの起点になりうる） */
  companionMayNudge: boolean;
  /** これが増えるたびカウントダウンをリセット */
  activityEpoch: number;
  onPing: () => Promise<boolean>;
};

/**
 * 続きモードなどで、`silenceMs` 無ユーザー発話のあとモデル側から短文を挟むトリガ。
 */
export function useCompanionSilencePing({
  enabled,
  paused,
  silenceMs = 30_000,
  companionMayNudge,
  activityEpoch,
  onPing,
}: CompanionSilencePingArgs): void {
  const deadlineRef = useRef<number>(Date.now() + silenceMs);
  const inFlightRef = useRef(false);

  useEffect(() => {
    deadlineRef.current = Date.now() + silenceMs;
  }, [activityEpoch, silenceMs]);

  useEffect(() => {
    if (!enabled) return undefined;
    const id = window.setInterval(() => {
      if (paused || !companionMayNudge || inFlightRef.current) return;
      if (Date.now() < deadlineRef.current) return;
      inFlightRef.current = true;
      void (async () => {
        try {
          const ok = await onPing();
          if (ok) {
            deadlineRef.current = Date.now() + silenceMs;
          }
        } finally {
          inFlightRef.current = false;
        }
      })();
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled, paused, silenceMs, companionMayNudge, onPing]);
}
