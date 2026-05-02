/** 親密共有（秘密の独白）自動挿入が一度済みか */
const KEY = (charId: string) => `intimate_secret_${charId}`;

export function loadIntimateSecretShown(charId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY(charId)) === "1";
  } catch {
    return false;
  }
}

export function saveIntimateSecretShown(charId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(charId), "1");
  } catch {
    // ignore
  }
}

export function clearIntimateSecretShown(charId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY(charId));
  } catch {
    // ignore
  }
}
