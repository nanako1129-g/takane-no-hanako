"use client";

import { useCallback, useState } from "react";
import type { StampDef } from "@/lib/stamps";

interface StampPickerProps {
  stamps: StampDef[];
  disabled?: boolean;
  onPick: (stampId: string) => void | Promise<void>;
}

export function StampPicker({ stamps, disabled, onPick }: StampPickerProps) {
  const [open, setOpen] = useState(false);

  const handlePick = useCallback(
    async (stampId: string) => {
      if (disabled) return;
      await onPick(stampId);
      setOpen(false);
    },
    [disabled, onPick]
  );

  return (
    <div className="rounded-2xl border border-rose-100/80 bg-white/95 shadow-sm backdrop-blur">
      <button
        type="button"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
      >
        <span className="text-base" aria-hidden>
          📎
        </span>
        <span>{open ? "スタンプをしまう" : "スタンプを送る"}</span>
        <span aria-hidden className="ml-auto text-slate-400">
          {open ? "△" : "▽"}
        </span>
      </button>
      {open && (
        <div className="border-t border-rose-100 px-3 pb-3 pt-2">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
            {stamps.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                aria-label={`スタンプ: ${s.label}`}
                onClick={() => void handlePick(s.id)}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white p-2 text-[10px] text-slate-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block text-[1.75rem] leading-none">{s.emoji}</span>
                <span className="max-w-[4rem] truncate text-center">{s.alt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
