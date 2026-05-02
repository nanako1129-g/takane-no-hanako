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

  /** `{children}` を省略するとこのセグメントが 404 になるため、オーバーレイだけ重ねる */
  const blockChatUi = !ready || !userProfile;

  return (
    <>
      {!ready ? (
        <div
          className="fixed inset-0 z-[940] min-h-dvh cursor-wait bg-[#fff7f4]/95"
          aria-busy="true"
          aria-label="読み込み中"
        />
      ) : null}
      {ready && !userProfile ? (
        <>
          <UserNameModal isOpen initialName="" onSubmit={handleNameSubmit} />
          <div className="fixed inset-0 z-[930] bg-[#fff7f4]" aria-hidden />
        </>
      ) : null}
      <div className={blockChatUi ? "pointer-events-none min-h-0" : "min-h-0"}>
        {children}
      </div>
    </>
  );
}
