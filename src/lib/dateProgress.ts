import type { CharacterConfig, DateInviteType, DateProgress } from "@/types";

const STORAGE_KEY = (charId: string) => `date_progress_${charId}`;

export const initialDateProgress: DateProgress = {
  teaCount: 0,
  drinkCount: 0,
  unlockedTea: false,
  unlockedDrink: false,
};

export function loadDateProgress(charId: string): DateProgress {
  if (typeof window === "undefined") return initialDateProgress;
  try {
    const raw = localStorage.getItem(STORAGE_KEY(charId));
    return raw
      ? { ...initialDateProgress, ...JSON.parse(raw) }
      : initialDateProgress;
  } catch {
    return initialDateProgress;
  }
}

export function saveDateProgress(charId: string, progress: DateProgress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY(charId), JSON.stringify(progress));
}

export function evaluateUnlocks(
  affinity: number,
  progress: DateProgress,
  character: CharacterConfig
): DateProgress {
  const teaTh = character.teaInviteThreshold ?? 75;
  const drinkTh = character.drinkInviteThreshold ?? 85;
  const reqTea = character.requiredTeaCountForDrink ?? 2;

  const next = { ...progress };
  if (!next.unlockedTea && affinity >= teaTh) next.unlockedTea = true;
  if (!next.unlockedDrink && affinity >= drinkTh && next.teaCount >= reqTea) {
    next.unlockedDrink = true;
  }
  return next;
}

export function canShowTeaButton(progress: DateProgress) {
  return progress.unlockedTea;
}

export function canShowDrinkButton(progress: DateProgress) {
  return progress.unlockedDrink;
}

export function canTriggerProposal(
  affinity: number,
  progress: DateProgress,
  character: CharacterConfig
): boolean {
  const proposalTh = character.proposalThreshold ?? 95;
  const reqDrink = character.requiredDrinkCountForProposal ?? 2;
  return affinity >= proposalTh && progress.drinkCount >= reqDrink;
}

export function incrementDateCount(
  progress: DateProgress,
  type: DateInviteType
): DateProgress {
  return {
    ...progress,
    teaCount: type === "tea" ? progress.teaCount + 1 : progress.teaCount,
    drinkCount:
      type === "drink" ? progress.drinkCount + 1 : progress.drinkCount,
  };
}
