"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCharacter, pickCharacterPortrait } from "@/characters";
import { clearCachedAnalysis } from "@/lib/analysisCache";
import { useProposalEndingAmbient } from "@/hooks/useProposalAmbient";
import type { Message } from "@/types";

const MESSAGES_PREFIX = "messages_";
const AFFINITY_PREFIX = "affinity_";
const PROPOSAL_PREFIX = "proposal_";
const DATE_PROGRESS_PREFIX = "date_progress_";

function readFinalData(charId: string): {
  affinity: number;
  userTurns: number;
  messages: Message[];
} {
  if (typeof window === "undefined")
    return { affinity: 0, userTurns: 0, messages: [] };

  let affinity = 0;
  try {
    const raw = window.localStorage.getItem(`${AFFINITY_PREFIX}${charId}`);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n)) affinity = Math.max(0, Math.min(100, Math.round(n)));
    }
  } catch { /* ignore */ }

  let messages: Message[] = [];
  try {
    const rawM = window.localStorage.getItem(`${MESSAGES_PREFIX}${charId}`);
    if (rawM) {
      const parsed = JSON.parse(rawM) as Message[];
      if (Array.isArray(parsed)) messages = parsed;
    }
  } catch { /* ignore */ }

  const userTurns = messages.filter((m) => m.role === "user").length;
  return { affinity, userTurns, messages };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = readFinalData(character.id);
    setAffinity(s.affinity);
    setUserTurns(s.userTurns);
    setMessages(s.messages);
    setStatsReady(true);
  }, [character.id]);

  useEffect(() => {
    if (showLogs) {
      window.setTimeout(
        () => logScrollRef.current?.scrollTo({ top: 0 }),
        50
      );
    }
  }, [showLogs]);

  useProposalEndingAmbient(statsReady);

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

        {messages.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowLogs(true)}
            className="flex w-full max-w-xs items-center justify-center gap-2 rounded-full border-2 border-rose-200/70 bg-gradient-to-b from-rose-50 to-white px-5 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:from-rose-100"
          >
            ❤️ 過去に話した内容を思い出す
          </button>
        ) : null}

        <p className="max-w-md text-[10px] leading-relaxed text-slate-400">
          ※ お台場の夜景が綺麗な海辺での本格プロポーズ演出は近日実装予定 🌊
        </p>
      </div>

      {/* 会話ログオーバーレイ */}
      {showLogs ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#fdf8f5]">
          {/* ヘッダー */}
          <header className="flex shrink-0 items-center gap-3 border-b border-rose-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => setShowLogs(false)}
              className="shrink-0 rounded-full px-2 py-1 text-sm text-slate-500 transition hover:bg-rose-50 hover:text-rose-500"
              aria-label="閉じる"
            >
              ‹ 戻る
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-rose-100">
                <Image
                  src={pickCharacterPortrait(character, affinity) ?? character.images.baseline}
                  alt={character.name}
                  fill
                  sizes="32px"
                  className="object-cover object-top"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {character.name} との思い出
                </p>
                <p className="text-[10px] text-slate-500">
                  {userTurns} 件の会話
                </p>
              </div>
            </div>
            <span className="shrink-0 text-lg">❤️</span>
          </header>

          {/* ログ一覧 */}
          <div
            ref={logScrollRef}
            className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-4"
          >
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* アバター（アシスタントのみ） */}
                  {!isUser ? (
                    <div className="relative mt-1 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-rose-100">
                      <Image
                        src={pickCharacterPortrait(character, affinity) ?? character.images.baseline}
                        alt={character.name}
                        fill
                        sizes="28px"
                        className="object-cover object-top"
                      />
                    </div>
                  ) : null}

                  <div className={`max-w-[78%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
                    {/* メッセージ本文 */}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
                        isUser
                          ? "rounded-tr-sm bg-rose-500 text-white"
                          : "rounded-tl-sm bg-white text-slate-800 ring-1 ring-slate-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {m.stampLabel
                          ? `【スタンプ：${m.stampLabel}】`
                          : m.content}
                      </p>
                    </div>

                    {/* 内心（アシスタントのみ） */}
                    {!isUser && m.inner ? (
                      <div className="ml-1 rounded-xl bg-amber-50/80 px-3 py-1.5 text-[11px] italic leading-relaxed text-amber-800/70 ring-1 ring-amber-200/40">
                        💭 {m.inner}
                      </div>
                    ) : null}

                    {/* 好感度変化（アシスタントのみ） */}
                    {!isUser &&
                    typeof m.affinityChange === "number" &&
                    m.affinityChange !== 0 ? (
                      <p
                        className={`text-[10px] font-medium ${
                          m.affinityChange > 0
                            ? "text-rose-400"
                            : "text-slate-400"
                        }`}
                      >
                        {m.affinityChange > 0 ? "+" : ""}
                        {m.affinityChange}
                      </p>
                    ) : null}

                    {/* 時刻 */}
                    <p className="px-1 text-[9px] text-slate-400">
                      {formatTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* 末尾の締め */}
            <div className="mt-6 text-center">
              <p className="text-2xl">💍</p>
              <p className="mt-2 text-xs text-slate-400">── END ──</p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
