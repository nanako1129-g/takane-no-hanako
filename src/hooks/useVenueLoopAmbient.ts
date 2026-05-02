"use client";

import { useEffect } from "react";
import { useBgmGlobalEnabled } from "@/components/BgmPreferenceProvider";

export type VenueLoopAmbientOptions = {
  /** `/public` からのパス（例 `/audio/foo.mp3`） */
  src: string;
  volume?: number;
};

/**
 * お茶／バーなど店シーン中だけループ環境音を再生。
 * - HTML5 Audio が失敗したときは Web Audio で極微弱なアルペジオへフォールバック。
 */
export function useVenueLoopAmbient(
  active: boolean,
  { src, volume = 0.14 }: VenueLoopAmbientOptions
): void {
  const bgmGloballyEnabled = useBgmGlobalEnabled();

  useEffect(() => {
    const effectiveActive = active && bgmGloballyEnabled;
    if (!effectiveActive) return undefined;
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    let cancelled = false;

    let useHtmlAudio = true;

    let resumeSynth: (() => void) | null = null;
    let stopSynth: (() => void) | null = null;

    const html = new Audio(src);
    html.loop = true;
    html.volume = volume;

    const playHtml = () => {
      if (cancelled || !useHtmlAudio) return;
      void html.play().catch(() => {});
    };

    const onInteract = () => {
      playHtml();
      resumeSynth?.();
    };
    window.addEventListener("pointerdown", onInteract);

    const onError = () => {
      html.removeEventListener("error", onError);
      if (cancelled) return;
      useHtmlAudio = false;
      html.pause();
      html.src = "";
      const s = createSubtleChordPad();
      stopSynth = s.stop;
      resumeSynth = s.resume;
    };

    html.addEventListener("error", onError);
    playHtml();

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onInteract);
      html.pause();
      html.removeEventListener("error", onError);
      html.src = "";
      stopSynth?.();
      resumeSynth = null;
      stopSynth = null;
    };
  }, [active, src, volume, bgmGloballyEnabled]);
}

function createSubtleChordPad(): {
  stop: () => void;
  resume: () => void;
} {
  const ACtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!ACtor) {
    return {
      stop: () => {},
      resume: () => {},
    };
  }

  const ctx = new ACtor();
  const master = ctx.createGain();
  master.gain.value = 0.045;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1400;
  lp.Q.value = 0.5;
  master.connect(lp);
  lp.connect(ctx.destination);

  const freqs = [130.81, 164.81, 196.0, 246.94];

  const playChord = () => {
    if (ctx.state !== "running") return;
    const tBase = ctx.currentTime + 0.02;
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(master);
      const start = tBase + i * 0.12;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.35, start + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 1.8);
      o.start(start);
      o.stop(start + 1.9);
    });
  };

  playChord();
  const id = window.setInterval(() => playChord(), 4600);

  const resume = () => {
    void ctx.resume().catch(() => {});
  };
  void ctx.resume().catch(() => {});

  return {
    stop: () => {
      window.clearInterval(id);
      void ctx.close();
    },
    resume,
  };
}
