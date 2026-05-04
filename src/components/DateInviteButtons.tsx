"use client";

import type { DateInviteType, DateProgress } from "@/types";
import {
  canShowDrinkButton,
  canShowTeaButton,
} from "@/lib/dateProgress";
import { useBgmGlobalEnabled } from "@/components/BgmPreferenceProvider";

type Props = {
  progress: DateProgress;
  onInvite: (type: DateInviteType) => void;
  disabled?: boolean;
};

export function DateInviteButtons({ progress, onInvite, disabled }: Props) {
  const showTea = canShowTeaButton(progress);
  const showDrink = canShowDrinkButton(progress);
  const bgmEnabled = useBgmGlobalEnabled();

  const playClick = () => {
    if (!bgmEnabled) return;
    try {
      const se = new Audio("/audio/ui-click.mp3");
      se.volume = 0.5;
      void se.play();
    } catch { /* ignore */ }
  };

  if (!showTea && !showDrink) return null;

  return (
    <div className="animate-fade-portrait flex gap-2 border-t border-rose-100 bg-rose-50/50 px-3 py-2">
      {showTea && (
        <button
          type="button"
          onClick={() => { playClick(); onInvite("tea"); }}
          disabled={disabled}
          className="flex items-center gap-1 rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
        >
          🍵 お茶に誘う
          {progress.teaCount > 0 && (
            <span className="ml-1 text-[10px] text-rose-400">
              ×{progress.teaCount}
            </span>
          )}
        </button>
      )}
      {showDrink && (
        <button
          type="button"
          onClick={() => { playClick(); onInvite("drink"); }}
          disabled={disabled}
          className="flex items-center gap-1 rounded-full border border-rose-400 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
        >
          🍶 飲みに誘う
          {progress.drinkCount > 0 && (
            <span className="ml-1 text-[10px] text-rose-400">
              ×{progress.drinkCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
