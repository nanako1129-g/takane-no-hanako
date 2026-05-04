"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { HeartIndicator } from "@/components/HeartIndicator";
import { BgmToggleButton, useBgmGlobalEnabled } from "@/components/BgmPreferenceProvider";
import { MessageInput } from "@/components/MessageInput";
import { messageContentForGemini } from "@/lib/stamps";
import { assistantTypingDelayMs, sleepMs } from "@/lib/replyLatency";
import { interpolateUserName } from "@/lib/promptInterpolate";
import { useTeaDateCafeAmbient } from "@/hooks/useTeaDateCafeAmbient";
import type { AffinityPulse, Character, ChatResponseBody, Message } from "@/types";

const DEFAULT_TEA_DATE_CAFE_INTRO =
  "あ、{userName}さん。お疲れさまです。\n" +
  "ここのコーヒー、香りがいいんですよ。\n" +
  "…来てくれて、ありがとうございます。";

/** 画像を最初に表示するまでのフェードイン時間 */
const CAFE_IMAGE_SHOW_MS = 200;
/** 会話画面（チャット欄）を表示するまでの時間 */
const CAFE_UI_SHOW_MS = 600;
/** 広角→アップに切り替えるターン数 */
const CAFE_PORTRAIT_SWITCH_TURNS = 2;
/** 広角→アップのクロスフェード時間 */
const CAFE_PAIR_CROSS_MS = 1000;

function newMsgId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type TeaDateCafePanelProps = {
  character: Character;
  affinity: number;
  affinityPulse?: AffinityPulse | null;
  /** API の userName（クライアントは表示名または空） */
  userName: string;
  /** 冒頭などテンプレの `{userName}` 差し込み用（保存プロフィールの生名前） */
  introTemplateUserName: string;
  portraitSrc: string | null;
  /** 親の SceneState と同期した店シーン内ターン数 */
  turnsInScene: number;
  minTurns: number;
  maxTurns: number;
  /** ユーザー1ターン完了（応答取得成功）ごとに親へ加算させる */
  onVenueTurnCompleted: () => void;
  onAffinityDelta: (delta: number) => void;
  /** 退店確定／アニメ後に LINE 復帰・teaCount を進める */
  onFinishedTeaDate: () => void;
  /** ヘッダーからの中断（teaCount は増やさず、約束のみ継続） */
  onInterruptTeaDate: () => void;
  /** `setLeaving(true)` と同タイミングで呼ばれる（親側の暗転用） */
  onBeforeLeave?: () => void;
};

export function TeaDateCafePanel({
  character,
  affinity,
  affinityPulse,
  userName,
  introTemplateUserName,
  portraitSrc,
  turnsInScene,
  minTurns,
  maxTurns,
  onVenueTurnCompleted,
  onAffinityDelta,
  onFinishedTeaDate,
  onInterruptTeaDate,
  onBeforeLeave,
}: TeaDateCafePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const departCafeRef = useRef<() => void>(() => {});
  const introOnce = useRef(false);

  const legacyBgSrc = character.teaDateBackgroundSrc?.trim();
  const emptyCafeSrc = character.teaDateEmptyBackgroundSrc?.trim();
  const withCafeSrc = character.teaDateWithCharacterBackgroundSrc?.trim();
  const extraCafeSrc = character.teaDateExtraBackgroundSrc?.trim();
  const hasPairCafe = Boolean(emptyCafeSrc && withCafeSrc);
  const resolvedSingleBg = !hasPairCafe ? legacyBgSrc : null;
  const showSceneHero = hasPairCafe || Boolean(resolvedSingleBg);

  const [entranceDone, setEntranceDone] = useState(false);
  /** 画像コンテナを表示するフラグ */
  const [imageVisible, setImageVisible] = useState(false);
  /**
   * ターン数で制御する「アップ写真へ切り替え」フラグ。
   * 2ターン会話するまでは広角のまま。
   */
  const characterArrived = hasPairCafe && turnsInScene >= CAFE_PORTRAIT_SWITCH_TURNS;
  const pairLayerVisible = characterArrived;
  const extraLayerVisible = Boolean(extraCafeSrc) && turnsInScene >= CAFE_PORTRAIT_SWITCH_TURNS + 1;

  const userSays = messages.filter((m) => m.role === "user").length;
  const showLeavePrompt =
    entranceDone &&
    turnsInScene >= minTurns &&
    turnsInScene < maxTurns &&
    !leaving;
  const inputBlocked =
    !entranceDone ||
    sending ||
    leaving ||
    turnsInScene >= maxTurns;

  useTeaDateCafeAmbient(entranceDone && !leaving);
  const bgmEnabled = useBgmGlobalEnabled();

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) fn();
        }, ms)
      );
    };

    // 1. 画像をフェードイン表示
    // 2. チャット欄・入力欄を解放（挨拶文も表示）
    // ※ 広角→アップの切り替えはターン数で制御（CAFE_PORTRAIT_SWITCH_TURNS ターン後）
    after(CAFE_IMAGE_SHOW_MS, () => setImageVisible(true));
    after(CAFE_UI_SHOW_MS, () => setEntranceDone(true));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!entranceDone || introOnce.current) return;
    introOnce.current = true;
    const introSource =
      character.teaDateIntroAssistantMessage?.trim() ||
      DEFAULT_TEA_DATE_CAFE_INTRO;
    const firstLine = interpolateUserName(
      introSource,
      introTemplateUserName
    );
    setMessages([
      {
        id: newMsgId(),
        role: "assistant",
        content: firstLine,
        createdAt: Date.now(),
      },
    ]);
    if (bgmEnabled && Math.random() < 0.5) {
      try {
        const se = new Audio("/audio/cafe-reply.mp3");
        se.volume = 0.4;
        void se.play();
      } catch { /* ignore */ }
    }
  }, [
    entranceDone,
    character.teaDateIntroAssistantMessage,
    introTemplateUserName,
    bgmEnabled,
  ]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const departCafe = useCallback(() => {
    if (leaving) return;
    onBeforeLeave?.();
    setLeaving(true);
    setError(null);
    window.setTimeout(() => {
      onFinishedTeaDate();
    }, 400);
  }, [leaving, onBeforeLeave, onFinishedTeaDate]);

  departCafeRef.current = departCafe;

  /** maxTurns 到達後は自動で店を終えて LINE に戻す */
  useEffect(() => {
    if (turnsInScene < maxTurns || leaving) return;
    const id = window.setTimeout(() => {
      departCafeRef.current();
    }, 700);
    return () => window.clearTimeout(id);
  }, [turnsInScene, maxTurns, leaving]);

  const interruptCafe = useCallback(() => {
    if (leaving || !entranceDone) return;
    if (
      userSays > 0 &&
      typeof window !== "undefined" &&
      !window.confirm(
        "喫茶店から出ます。お茶へのお誘いはそのまま残ります（カウントは増えません）。"
      )
    ) {
      return;
    }
    onBeforeLeave?.();
    setLeaving(true);
    setError(null);
    window.setTimeout(() => {
      onInterruptTeaDate();
    }, 400);
  }, [leaving, entranceDone, userSays, onBeforeLeave, onInterruptTeaDate]);

  const submitCafe = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || inputBlocked) return;

      if (bgmEnabled) {
        try {
          const se = new Audio("/audio/send.mp3");
          se.volume = 0.5;
          void se.play();
        } catch { /* ignore */ }
      }

      const userMsg: Message = {
        id: newMsgId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };

      setError(null);
      const historyForApi = messages.map((m) => ({
        role: m.role,
        content: messageContentForGemini(m),
      }));

      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      try {
        const body = {
          messages: historyForApi,
          affinity,
          userName,
          teaDateCafe: true,
          turnsInScene,
          maxTurns,
          charId: character.id,
          userMessage: messageContentForGemini(userMsg),
        };

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as ChatResponseBody;

        const wait = assistantTypingDelayMs(character, affinity);
        if (wait > 0) {
          await sleepMs(wait);
        }

        const assistantMsg: Message = {
          id: newMsgId(),
          role: "assistant",
          content: data.reply,
          inner: data.inner || undefined,
          affinityChange: data.affinityChange ?? 0,
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (bgmEnabled && Math.random() < 0.5) {
          try {
            const se = new Audio("/audio/cafe-reply.mp3");
            se.volume = 0.4;
            void se.play();
          } catch { /* ignore */ }
        }

        const delta =
          typeof data.affinityChange === "number" &&
          Number.isFinite(data.affinityChange)
            ? Math.max(-15, Math.min(15, Math.round(data.affinityChange)))
            : 0;
        if (delta !== 0) {
          onAffinityDelta(delta);
        }

        onVenueTurnCompleted();
      } catch (e) {
        console.error(e);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setError(
          e instanceof Error
            ? e.message
            : "通信に失敗しました。もう一度お試しください。"
        );
      } finally {
        setSending(false);
      }
    },
    [
      affinity,
      character,
      inputBlocked,
      maxTurns,
      bgmEnabled,
      messages,
      onAffinityDelta,
      onVenueTurnCompleted,
      turnsInScene,
      userName,
    ]
  );

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col bg-[#f2ede8] ${
        leaving
          ? "pointer-events-none animate-scene-fade-out"
          : "animate-scene-fade-in"
      }`}
      role="dialog"
      aria-label="お茶デート・喫茶店シーン"
      aria-busy={!entranceDone}
    >
      {/* ヘッダー：3カラム（名前 / ハート / BGM+中断） */}
      <header className="relative z-10 grid min-h-[3.25rem] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 border-b border-amber-900/10 bg-[#e8dfd6]/95 px-3 py-2 shadow-sm backdrop-blur-md sm:px-4">
        {/* 左：キャラ名 */}
        <div className="flex min-w-0 items-center gap-2">
          {portraitSrc ? (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-amber-900/20">
              <Image src={portraitSrc} alt={character.name} fill sizes="32px" className="object-cover object-top" />
            </div>
          ) : null}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-slate-800">{character.name}</p>
            <p className="truncate text-[10px] text-slate-500">☕ 喫茶店</p>
          </div>
        </div>
        {/* 中央：ハート */}
        <div className="flex justify-center">
          <HeartIndicator affinity={affinity} pulse={affinityPulse ?? null} />
        </div>
        {/* 右：BGM + 中断 */}
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <BgmToggleButton />
          <button
            type="button"
            onClick={() => {
              if (bgmEnabled) { try { const se = new Audio("/audio/ui-click.mp3"); se.volume = 0.5; void se.play(); } catch { /* ignore */ } }
              interruptCafe();
            }}
            disabled={leaving || !entranceDone}
            className="shrink-0 rounded-full border border-slate-400/40 bg-white/60 px-2 py-1 text-[10px] font-medium text-slate-700 backdrop-blur transition hover:bg-white/80 disabled:opacity-40 sm:px-3 sm:text-[11px]"
          >
            中断
          </button>
        </div>
      </header>

      {/* メインコンテンツ：画像 ＋ 会話 */}
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* 喫茶店の1枚絵（中央に配置） */}
        {showSceneHero ? (
          <div className={`shrink-0 px-3 pb-1.5 pt-2 transition-opacity duration-500 sm:px-4 sm:pb-2 sm:pt-3 ${imageVisible ? "opacity-100" : "opacity-0"}`}>
            <div
              className="relative isolate mx-auto h-[min(30vh,240px)] overflow-hidden rounded-2xl bg-stone-300/25 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.28)] ring-1 ring-white/80 sm:h-[min(36vh,320px)]"
              style={{ maxWidth: "min(92vw, 420px)" }}
            >
              {/* 縦長カットは object-contain で全体表示（顔〜テーブル・カップまで）。余白は背景で埋める */}
              {hasPairCafe && emptyCafeSrc ? (
                <Image
                  src={emptyCafeSrc}
                  alt="喫茶店"
                  fill
                  sizes="(max-width: 768px) 92vw, 420px"
                  priority
                  className="object-contain object-center"
                />
              ) : null}
              {hasPairCafe && withCafeSrc ? (
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: pairLayerVisible && !extraLayerVisible ? 1 : pairLayerVisible ? 1 : 0,
                    transitionProperty: "opacity",
                    transitionDuration: `${CAFE_PAIR_CROSS_MS}ms`,
                    transitionTimingFunction: "ease-out",
                  }}
                >
                  <Image
                    src={withCafeSrc}
                    alt="花咲さんと喫茶店"
                    fill
                    sizes="(max-width: 768px) 92vw, 420px"
                    priority={pairLayerVisible}
                    className="object-contain object-center"
                  />
                </div>
              ) : null}
              {extraCafeSrc ? (
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: extraLayerVisible ? 1 : 0,
                    transitionProperty: "opacity",
                    transitionDuration: `${CAFE_PAIR_CROSS_MS}ms`,
                    transitionTimingFunction: "ease-out",
                  }}
                >
                  <Image
                    src={extraCafeSrc}
                    alt="花咲さんと喫茶店"
                    fill
                    sizes="(max-width: 768px) 92vw, 420px"
                    priority={extraLayerVisible}
                    className="object-contain object-center"
                  />
                </div>
              ) : null}
              {resolvedSingleBg ? (
                <Image
                  src={resolvedSingleBg}
                  alt="喫茶店"
                  fill
                  sizes="(max-width: 768px) 92vw, 420px"
                  priority
                  className="object-contain object-center"
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {/* スクロール可能な会話エリア */}
        <div
          ref={scrollRef}
          className={`scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 transition-opacity duration-500 ${
            entranceDone ? "opacity-100" : "opacity-0"
          }`}
        >
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              message={m}
              characterName={character.displayName}
              characterAvatarSrc={portraitSrc ?? undefined}
              characterAvatarAlt={character.name}
            />
          ))}
          {sending && (
            <p className="px-2 text-xs text-slate-600">
              {character.displayName}が考えています…
            </p>
          )}
          {error ? (
            <div className="rounded-xl border border-red-400/70 bg-red-50 px-3 py-2 text-xs text-red-900">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      {/* フッター：入力エリア */}
      <footer
        className={`relative z-10 mt-auto shrink-0 flex-col gap-2 border-t border-amber-900/10 bg-[#e8dfd6]/95 px-3 py-3 backdrop-blur-md shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)] transition-opacity duration-500 ${
          entranceDone ? "opacity-100 flex" : "opacity-0 hidden"
        }`}
      >
        {showLeavePrompt ? (
          <button
            type="button"
            onClick={() => {
              if (bgmEnabled) { try { const se = new Audio("/audio/ui-click.mp3"); se.volume = 0.5; void se.play(); } catch { /* ignore */ } }
              departCafe();
            }}
            disabled={leaving}
            className="w-full rounded-2xl border border-amber-900/25 bg-gradient-to-r from-amber-100 to-rose-50 px-4 py-3 text-sm font-semibold text-amber-950 shadow-sm transition hover:from-amber-50 hover:to-rose-100 disabled:opacity-50"
          >
            そろそろ帰りますか
          </button>
        ) : null}

        {turnsInScene >= minTurns &&
        turnsInScene < maxTurns &&
        !leaving &&
        !showLeavePrompt &&
        entranceDone ? (
          <p className="text-center text-[11px] text-slate-600">
            あと <span className="font-semibold text-slate-800">{minTurns - turnsInScene}</span> ターンで「帰りますか」が選べます
          </p>
        ) : null}

        {turnsInScene >= maxTurns && !leaving && entranceDone ? (
          <p className="text-center text-[11px] text-slate-600">
            楽しい時間だったね。また連絡するね…（自動で席を立ちます）
          </p>
        ) : null}

        <MessageInput
          onSubmit={(t) => void submitCafe(t)}
          disabled={inputBlocked}
          placeholder={
            !entranceDone
              ? "シーン移行中…"
              : turnsInScene >= maxTurns
              ? "この喫茶店での会話はおしまいです"
              : `喫茶店で話す（残り ${maxTurns - turnsInScene} ターン）`
          }
        />
      </footer>
    </div>
  );
}
