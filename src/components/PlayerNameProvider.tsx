"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { UserNameModal } from "@/components/UserNameModal";
import { loadUserProfile, saveUserProfile } from "@/lib/playerNameStorage";
import type { UserProfile } from "@/types";

type PlayerNameContextValue = {
  profile: UserProfile | null;
  ready: boolean;
  saveProfile: (next: UserProfile) => void;
};

const PlayerNameContext = createContext<PlayerNameContextValue | null>(null);

export function usePlayerProfileState(): PlayerNameContextValue {
  const ctx = useContext(PlayerNameContext);
  if (!ctx) {
    throw new Error(
      "usePlayerProfileState は PlayerNameProvider 内でのみ使えます"
    );
  }
  return ctx;
}

/** 名前登録済みのときのみ */
export function usePlayerDisplayName(): string {
  const { profile } = usePlayerProfileState();
  if (!profile) {
    throw new Error(
      "usePlayerDisplayName は名前が登録済みのときのみ使えます"
    );
  }
  return profile.name;
}

/** 名前登録済みのときのみ */
export function usePlayerProfile(): UserProfile {
  const { profile } = usePlayerProfileState();
  if (!profile) {
    throw new Error(
      "usePlayerProfile は名前が登録済みのときのみ使えます"
    );
  }
  return profile;
}

export function PlayerNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  /** チャット画面の ⚙️ から開く名前変更 */
  const [chatNameModalOpen, setChatNameModalOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUserProfile(loadUserProfile());
    setReady(true);
  }, []);

  const saveProfile = useCallback((next: UserProfile) => {
    saveUserProfile(next);
    setUserProfile(next);
  }, []);

  const showChatGear =
    Boolean(userProfile) &&
    ready &&
    /^\/chat\/[^/]+$/.test(pathname ?? "");

  /** App Router はルートレイアウトが常に `{children}` を渡す必要がある。ここでは返さず重ねないと `/` が 404 になる。 */
  return (
    <PlayerNameContext.Provider
      value={{
        profile: userProfile,
        ready,
        saveProfile,
      }}
    >
      {!ready ? (
        <div
          className="fixed inset-0 z-[950] min-h-dvh cursor-wait bg-[#fff7f4]/95"
          aria-busy="true"
          aria-label="読み込み中"
        />
      ) : null}

      {showChatGear ? (
        <button
          type="button"
          onClick={() => setChatNameModalOpen(true)}
          className="fixed top-3 right-3 z-[900] bg-transparent p-2 text-sm text-gray-500 transition hover:text-rose-500"
          title="名前を変更"
          aria-label="名前を変更"
        >
          ⚙️
        </button>
      ) : null}

      <UserNameModal
        isOpen={chatNameModalOpen}
        initialName={userProfile?.name ?? ""}
        onSubmit={(name) => {
          saveProfile({
            name,
            createdAt: userProfile?.createdAt ?? Date.now(),
          });
          setChatNameModalOpen(false);
        }}
        onCancel={() => setChatNameModalOpen(false)}
      />

      {children}
    </PlayerNameContext.Provider>
  );
}
