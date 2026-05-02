"use client";

import { UserNameModal } from "@/components/UserNameModal";
import { usePlayerProfileState } from "@/components/PlayerNameProvider";
import type { UserProfile } from "@/types";

export default function ChatCharLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile: userProfile, ready, saveProfile } = usePlayerProfileState();

  const handleNameSubmit = (name: string) => {
    const profile: UserProfile = { name, createdAt: Date.now() };
    saveProfile(profile);
  };

  if (!ready) {
    return (
      <div
        className="min-h-dvh bg-[#fff7f4]"
        aria-busy="true"
        aria-label="読み込み中"
      />
    );
  }

  if (!userProfile) {
    return (
      <>
        <div className="min-h-dvh bg-[#fff7f4]" aria-hidden />
        {/* チャット直リンク時: 名前未設定ならトップへ飛ばさず強制モーダル */}
        <UserNameModal isOpen initialName="" onSubmit={handleNameSubmit} />
      </>
    );
  }

  return <>{children}</>;
}
