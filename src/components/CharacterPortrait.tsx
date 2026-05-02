"use client";

import Image from "next/image";
import type { Character } from "@/types";
import { imageSrcForAffinity } from "@/lib/characterPortrait";

export interface CharacterPortraitProps {
  affinity: number;
  character: Character;
  className?: string;
}

/**
 * チャット左カラム用の縦長立ち絵。好感度で表情差し替え＋フェード（300ms）。
 */
export function CharacterPortrait({
  affinity,
  character,
  className = "",
}: CharacterPortraitProps) {
  const src = imageSrcForAffinity(character.images, affinity);

  return (
    <div className={`relative mx-auto overflow-hidden rounded-2xl bg-slate-100 shadow-md ring-1 ring-rose-100/80 ${className}`}>
      {/* 9:16 縦長。モバイルは親で h-[40vh] と組み合わせ、MD は親が幅を決める */}
      <div className="relative aspect-[9/16] w-full">
        <Image
          key={src}
          src={src}
          alt={`${character.name}の立ち絵`}
          fill
          sizes="(max-width: 767px) 45vw, 35vw"
          className="object-cover animate-fade-portrait"
          priority
        />
      </div>
    </div>
  );
}
