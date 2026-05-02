import type { UserProfile } from "@/types";

export const STORAGE_KEY = "user_profile";

export function loadUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveUserProfile(profile: UserProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearUserProfile() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
