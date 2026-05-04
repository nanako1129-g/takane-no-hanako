"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCharacter, pickCharacterPortrait } from "@/characters";
import { clearCachedAnalysis } from "@/lib/analysisCache";
import { useProposalEndingAmbient } from "@/hooks/useProposalAmbient";
import { useMemoryGalleryAmbient } from "@/hooks/useMemoryGalleryAmbient";
import { useBgmGlobalEnabled } from "@/components/BgmPreferenceProvider";
import type { Character, Message } from "@/types";

const MESSAGES_PREFIX = "messages_";
const AFFINITY_PREFIX = "affinity_";
const PROPOSAL_PREFIX = "proposal_";
const DATE_PROGRESS_PREFIX = "date_progress_";
const POST_ENDING_PREFIX = "post_ending_";
const AWAITING_PREFIX = "awaiting_outing_";

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

type ScenePhoto = { src: string; label: string; sub?: string };

/** キャラクター設定からシーン写真一覧を組み立てる */
function buildScenePhotos(character: Character): ScenePhoto[] {
  const photos: ScenePhoto[] = [];
  const cafeName = character.teaDateLocationName ?? "喫茶店";
  const barName = character.barDateLocationName ?? "居酒屋";

  if (character.teaDateEmptyBackgroundSrc) {
    photos.push({ src: character.teaDateEmptyBackgroundSrc, label: cafeName, sub: "待ち合わせ" });
  }
  if (character.teaDateWithCharacterBackgroundSrc) {
    photos.push({ src: character.teaDateWithCharacterBackgroundSrc, label: cafeName, sub: "ふたりの時間" });
  }
  if (character.teaDateExtraBackgroundSrc) {
    photos.push({ src: character.teaDateExtraBackgroundSrc, label: cafeName, sub: "もう一杯" });
  }
  if (character.barDateArrivalSrc) {
    photos.push({ src: character.barDateArrivalSrc, label: barName, sub: "到着" });
  }
  if (character.barDateWithCharacterBackgroundSrc) {
    photos.push({ src: character.barDateWithCharacterBackgroundSrc, label: barName, sub: "乾杯" });
  }
  if (character.barDateSilenceHeroSrc) {
    photos.push({ src: character.barDateSilenceHeroSrc, label: barName, sub: "夜景と沈黙" });
  }
  const proposalName = character.proposalDateLocationName ?? "プロポーズ";
  if (character.proposalDateSceneSrcs?.length) {
    const labels = ["夜の公園", "花咲さん登場", "ふたりで散歩", "プロポーズの瞬間", "ブレスレット", "笑顔"];
    character.proposalDateSceneSrcs.forEach((src, i) => {
      photos.push({ src, label: proposalName, sub: labels[i] ?? `シーン${i + 1}` });
    });
  } else if (character.proposalDateSceneSrc) {
    photos.push({ src: character.proposalDateSceneSrc, label: proposalName, sub: "大切な夜" });
  }
  if (character.endingMainImageSrc) {
    photos.push({ src: character.endingMainImageSrc, label: "付き合った後", sub: "花束" });
  }
  if (character.endingSubImageSrc) {
    photos.push({ src: character.endingSubImageSrc, label: "付き合った後", sub: "カフェデート" });
  }
  photos.push({ src: character.images.happy, label: character.name, sub: "笑顔" });
  photos.push({ src: character.images.cool, label: character.name, sub: "真剣な表情" });

  return photos;
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

  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [pageVisible, setPageVisible] = useState(false);
  const scenePhotos = buildScenePhotos(character);
  const bgmEnabled = useBgmGlobalEnabled();

  const playMenuSe = useCallback(() => {
    if (!bgmEnabled) return;
    try {
      const se = new Audio("/audio/menu-select.mp3");
      se.volume = 0.6;
      void se.play();
    } catch { /* ignore */ }
  }, [bgmEnabled]);

  useEffect(() => {
    const s = readFinalData(character.id);
    setAffinity(s.affinity);
    setUserTurns(s.userTurns);
    setMessages(s.messages);
    setStatsReady(true);
  }, [character.id]);

  // マウント後に白オーバーレイをフェードアウト
  useEffect(() => {
    const id = window.setTimeout(() => setPageVisible(true), 50);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (showLogs) {
      window.setTimeout(
        () => logScrollRef.current?.scrollTo({ top: 0 }),
        50
      );
    }
  }, [showLogs]);

  useProposalEndingAmbient(statsReady && !showGallery);
  useMemoryGalleryAmbient(showGallery);

  const handleReplay = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(`${AFFINITY_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${PROPOSAL_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${DATE_PROGRESS_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${MESSAGES_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${POST_ENDING_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${AWAITING_PREFIX}${character.id}`);
      clearCachedAnalysis(character.id);
    } catch {
      // ignore
    }
    router.push("/");
  }, [character.id, router]);

  /** エンディング後の続きプレイ：好感度を保持してチャットへ（上限200に拡張） */
  const handleContinue = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      // 会話ログ・日付進行・待機状態はリセット、好感度は保持
      window.localStorage.removeItem(`${MESSAGES_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${DATE_PROGRESS_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${AWAITING_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${PROPOSAL_PREFIX}${character.id}`);
      // 続きプレイフラグをセット
      window.localStorage.setItem(`${POST_ENDING_PREFIX}${character.id}`, "true");
      clearCachedAnalysis(character.id);
    } catch {
      // ignore
    }
    router.push(`/chat/${character.id}`);
  }, [character.id, router]);

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-8 bg-gradient-to-b from-white via-rose-50/40 to-white px-6 py-12 text-center">
      {/* 遷移時の白フェードインオーバーレイ */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 bg-white"
        style={{
          opacity: pageVisible ? 0 : 1,
          transition: pageVisible ? "opacity 900ms ease-out" : "none",
        }}
      />
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

        <div className="relative w-full max-w-[320px] overflow-hidden rounded-2xl shadow-md ring-1 ring-rose-100" style={{ aspectRatio: "3/4" }}>
          <Image
            src={character.endingMainImageSrc ?? character.images.happy}
            alt={`${character.name}（エンディング）`}
            fill
            className="object-cover object-top"
            sizes="320px"
            priority
          />
        </div>

        <blockquote className="max-w-md space-y-3 text-sm leading-relaxed text-slate-700">
          <p>「ありがとう。これから、ゆっくり君と歩いていきたい。」</p>
          <p className="text-[13px] text-slate-500">─ {character.name} ─</p>
        </blockquote>

        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => { playMenuSe(); handleContinue(); }}
            className="w-full rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
          >
            💌 エンディングの続きから遊ぶ
          </button>
          <p className="text-center text-[11px] text-slate-400">
            好感度を引き継いで続きのチャット（上限200に拡張）
          </p>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => { playMenuSe(); handleReplay(); }}
              className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 sm:w-auto sm:min-w-[180px]"
            >
              🔄 最初から遊ぶ
            </button>
            <Link
              href={`/analysis/${character.id}`}
              className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 sm:w-auto sm:min-w-[180px]"
            >
              分析を見る
            </Link>
          </div>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={() => { playMenuSe(); setShowLogs(true); }}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-rose-200/70 bg-gradient-to-b from-rose-50 to-white px-5 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:from-rose-100"
            >
              ❤️ 過去に話した内容を思い出す
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => { playMenuSe(); setGalleryIndex(0); setShowGallery(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-amber-200/70 bg-gradient-to-b from-amber-50 to-white px-5 py-3 text-sm font-semibold text-amber-800 shadow-sm transition hover:border-amber-300 hover:from-amber-100"
          >
            🌟 思い出のシーンを振り返る
          </button>
        </div>
      </div>

      {/* シーンギャラリーオーバーレイ */}
      {showGallery ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          {/* ヘッダー */}
          <header className="flex shrink-0 items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setShowGallery(false)}
              className="rounded-full px-2 py-1 text-sm text-white/70 transition hover:text-white"
            >
              ‹ 戻る
            </button>
            <p className="text-xs text-white/50">
              {galleryIndex + 1} / {scenePhotos.length}
            </p>
            <div className="w-16" />
          </header>

          {/* 画像エリア */}
          <div className="relative min-h-0 flex-1">
            <Image
              key={scenePhotos[galleryIndex].src}
              src={scenePhotos[galleryIndex].src}
              alt={scenePhotos[galleryIndex].label}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
            {/* 左右タップ領域 */}
            <button
              type="button"
              aria-label="前へ"
              onClick={() => setGalleryIndex((i) => (i - 1 + scenePhotos.length) % scenePhotos.length)}
              className="absolute inset-y-0 left-0 w-1/3"
            />
            <button
              type="button"
              aria-label="次へ"
              onClick={() => setGalleryIndex((i) => (i + 1) % scenePhotos.length)}
              className="absolute inset-y-0 right-0 w-1/3"
            />
          </div>

          {/* フッター：ラベル＋ドットナビ */}
          <footer className="shrink-0 pb-safe px-4 pb-6 pt-3 text-center">
            <p className="text-base font-semibold text-white/90">
              {scenePhotos[galleryIndex].label}
            </p>
            {scenePhotos[galleryIndex].sub ? (
              <p className="mt-0.5 text-xs text-white/50">
                {scenePhotos[galleryIndex].sub}
              </p>
            ) : null}
            {/* ドットインジケータ */}
            <div className="mt-3 flex justify-center gap-1.5">
              {scenePhotos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setGalleryIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === galleryIndex
                      ? "w-4 bg-white"
                      : "w-1.5 bg-white/30"
                  }`}
                  aria-label={`${i + 1}枚目`}
                />
              ))}
            </div>
          </footer>
        </div>
      ) : null}

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
