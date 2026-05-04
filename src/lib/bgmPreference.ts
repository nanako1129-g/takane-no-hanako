const STORAGE_KEY = "takane_bgm_global_enabled";

export function loadBgmPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return false; // 初回デフォルトは OFF
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
  } catch {
    // ignore
  }
  return false;
}

export function saveBgmPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}
