"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getCharacter } from "@/characters";
import { clearCachedAnalysis } from "@/lib/analysisCache";
import type { Message } from "@/types";

const MESSAGES_PREFIX = "messages_";
const AFFINITY_PREFIX = "affinity_";
const PROPOSAL_PREFIX = "proposal_";
const DATE_PROGRESS_PREFIX = "date_progress_";

function readFinalStats(charId: string): {
  affinity: number;
  userTurns: number;
} {
  if (typeof window === "undefined") return { affinity: 0, userTurns: 0 };

  let affinity = 0;
  try {
    const raw = window.localStorage.getItem(`${AFFINITY_PREFIX}${charId}`);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        affinity = Math.max(0, Math.min(100, Math.round(n)));
      }
    }
  } catch {
    // ignore
  }

  let userTurns = 0;
  try {
    const rawM = window.localStorage.getItem(`${MESSAGES_PREFIX}${charId}`);
    if (rawM) {
      const parsed = JSON.parse(rawM) as Message[];
      if (Array.isArray(parsed)) {
        userTurns = parsed.filter((m) => m.role === "user").length;
      }
    }
  } catch {
    // ignore
  }

  return { affinity, userTurns };
}

export default function EndingPage({
  params,
}: {
  params: { charId: string };
}) {
  const character = getCharacter(params.charId);
  if (!character) notFound();

  const router = useRouter();
  const [statsReady, setStatsReady] = useState(false);
  const [affinity, setAffinity] = useState(0);
  const [userTurns, setUserTurns] = useState(0);

  useEffect(() => {
    const s = readFinalStats(character.id);
    setAffinity(s.affinity);
    setUserTurns(s.userTurns);
    setStatsReady(true);
  }, [character.id]);

  const handleReplay = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(`${AFFINITY_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${PROPOSAL_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${DATE_PROGRESS_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${MESSAGES_PREFIX}${character.id}`);
      clearCachedAnalysis(character.id);
    } catch {
      // ignore
    }
    router.push("/");
  }, [character.id, router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-8 bg-gradient-to-b from-white via-rose-50/40 to-white px-6 py-12 text-center">
      <div
        className={`flex w-full flex-col items-center gap-6 ${statsReady ? "animate-fade-ending" : "opacity-0"}`}
      >
        <p className="text-xs font-semibold tracking-[0.25em] text-rose-400">
          GOOD ENDING
        </p>
        <h1 className="text-xl font-bold leading-snug text-slate-800 sm:text-2xl">
          END：{character.name}ルート 完了 💍
        </h1>

        <div className="w-full max-w-[280px] space-y-1 rounded-2xl border border-rose-100 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
          <p>
            最終好感度：<span className="font-semibold">{affinity}</span>/100
          </p>
          <p>
            会話ターン数：<span className="font-semibold">{userTurns}</span>
          </p>
        </div>

        <div className="relative aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-2xl shadow-md ring-1 ring-rose-100">
          <Image
            src={character.images.happy}
            alt={`${character.name}（表情）`}
            fill
            className="object-cover"
            sizes="220px"
            priority
          />
        </div>

        <blockquote className="max-w-md space-y-3 text-sm leading-relaxed text-slate-700">
          <p>「ありがとう。これから、ゆっくり君と歩いていきたい。」</p>
          <p className="text-[13px] text-slate-500">─ {character.name} ─</p>
        </blockquote>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleReplay}
            className="w-full rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 sm:w-auto sm:min-w-[180px]"
          >
            もう一度遊ぶ
          </button>
          <Link
            href={`/analysis/${character.id}`}
            className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 sm:w-auto sm:min-w-[180px]"
          >
            分析を見る
          </Link>
        </div>

        <p className="max-w-md text-[10px] leading-relaxed text-slate-400">
          ※ お台場の夜景が綺麗な海辺での本格プロポーズ演出は近日実装予定 🌊
        </p>
      </div>
    </main>
  );
}
