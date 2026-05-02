"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "affinity_";

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function useAffinity(charId: string, initialAffinity: number) {
  const [affinity, setAffinity] = useState<number>(initialAffinity);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${charId}`);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          setAffinity(clamp(parsed));
        }
      }
    } catch {
      // localStorage が使えない環境は無視
    }
    setHydrated(true);
  }, [charId]);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}${charId}`,
        String(affinity)
      );
    } catch {
      // ignore
    }
  }, [affinity, charId, hydrated]);

  return { affinity, setAffinity, hydrated };
}
