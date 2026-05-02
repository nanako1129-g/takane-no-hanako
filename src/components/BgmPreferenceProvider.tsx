"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadBgmPreference, saveBgmPreference } from "@/lib/bgmPreference";

type BgmPreferenceContextValue = {
  /** 永続化済み（初回マウント後） */
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
  hydrated: boolean;
};

const BgmPreferenceContext =
  createContext<BgmPreferenceContextValue | null>(null);

/** Provider 外では常に `true` 扱い（ユニットテストや Story 向けフォールバック） */
export function useBgmGlobalEnabled(): boolean {
  const ctx = useContext(BgmPreferenceContext);
  return ctx?.enabled ?? true;
}

export function useBgmPreference(): BgmPreferenceContextValue {
  const ctx = useContext(BgmPreferenceContext);
  if (!ctx) {
    throw new Error("useBgmPreference は BgmPreferenceProvider 内のみ");
  }
  return ctx;
}

export function BgmPreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabled, setEnabledState] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEnabledState(loadBgmPreference());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveBgmPreference(enabled);
  }, [enabled, hydrated]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
  }, []);

  const toggle = useCallback(() => {
    setEnabledState((v) => !v);
  }, []);

  const value = useMemo(
    () => ({ enabled, setEnabled, toggle, hydrated }),
    [enabled, setEnabled, toggle, hydrated]
  );

  return (
    <BgmPreferenceContext.Provider value={value}>
      {children}
    </BgmPreferenceContext.Provider>
  );
}

function bgmToggleBtnClass(enabled: boolean): string {
  return [
    "inline-flex items-center gap-1.5 rounded-full border text-[10px] font-semibold shadow-sm backdrop-blur-md transition active:scale-[0.97] sm:text-[11px]",
    enabled
      ? "border-rose-200/70 bg-white/92 text-slate-800 hover:bg-rose-50/95"
      : "border-slate-300/80 bg-slate-800/88 text-slate-100 hover:bg-slate-700/90",
  ].join(" ");
}

/** チャットヘッダーなどに埋め込むコンパクト BGM 切替 */
export function BgmToggleButton({
  className,
}: {
  className?: string;
}) {
  const ctx = useContext(BgmPreferenceContext);
  if (!ctx?.hydrated) return null;

  const { enabled, toggle } = ctx;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? "BGMをオフにする" : "BGMをオンにする"}
      onClick={() => toggle()}
      className={`${bgmToggleBtnClass(enabled)} shrink-0 whitespace-nowrap px-2 py-1.5 sm:px-3 ${className ?? ""}`}
    >
      <span aria-hidden className="text-sm leading-none">
        {enabled ? "🔊" : "🔇"}
      </span>
      <span>
        BGM{" "}
        <span className="font-bold">{enabled ? "ON" : "OFF"}</span>
      </span>
    </button>
  );
}

/** 画面上部のコンパクト BGM 切替（`/chat/*` 以外・全シーン共通） */
export function BgmFloatingToggle() {
  const ctx = useContext(BgmPreferenceContext);
  if (!ctx?.hydrated) return null;

  const { enabled, toggle } = ctx;

  return (
    <div
      className="fixed right-2 z-[200] max-w-[min(100vw-1rem,200px)] sm:right-3"
      style={{
        top: "max(8px, env(safe-area-inset-top, 0px))",
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? "BGMをオフにする" : "BGMをオンにする"}
        onClick={() => toggle()}
        className={`${bgmToggleBtnClass(enabled)} px-3 py-1.5 shadow-md`}
      >
        <span aria-hidden className="text-sm">
          {enabled ? "🔊" : "🔇"}
        </span>
        <span>
          BGM <span className="font-bold">{enabled ? "ON" : "OFF"}</span>
        </span>
      </button>
    </div>
  );
}
