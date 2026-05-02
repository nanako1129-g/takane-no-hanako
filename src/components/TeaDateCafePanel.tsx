"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { MessageInput } from "@/components/MessageInput";
import { messageContentForGemini } from "@/lib/stamps";
import { assistantTypingDelayMs, sleepMs } from "@/lib/replyLatency";
import { interpolateUserName } from "@/lib/promptInterpolate";
import { useTeaDateCafeAmbient } from "@/hooks/useTeaDateCafeAmbient";
import type { Character, ChatResponseBody, Message } from "@/types";

const DEFAULT_TEA_DATE_CAFE_INTRO =
  "あ、{userName}さん。お疲れさまです。\n" +
  "ここのコーヒー、香りがいいんですよ。\n" +
  "…来てくれて、ありがとうございます。";

const CAFE_SOLO_HOLD_MS = 550;
const CAFE_PAIR_CROSS_MS = 880;
const CAFE_POST_AMBIENT_MS = 200;

function newMsgId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type TeaDateCafePanelProps = {
  character: Character;
  affinity: number;
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
};

export function TeaDateCafePanel({
  character,
  affinity,
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
  const hasPairCafe = Boolean(emptyCafeSrc && withCafeSrc);
  const resolvedSingleBg = !hasPairCafe ? legacyBgSrc : null;
  const showSceneHero = hasPairCafe || Boolean(resolvedSingleBg);

  const [entranceDone, setEntranceDone] = useState(() => !hasPairCafe);
  const [pairLayerVisible, setPairLayerVisible] = useState(() => !hasPairCafe);

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

  useEffect(() => {
    if (!hasPairCafe) return;
    let cancelled = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) fn();
        }, ms)
      );
    };

    after(CAFE_SOLO_HOLD_MS, () => setPairLayerVisible(true));
    after(
      CAFE_SOLO_HOLD_MS + CAFE_PAIR_CROSS_MS + CAFE_POST_AMBIENT_MS,
      () => setEntranceDone(true)
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [hasPairCafe]);

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
  }, [
    entranceDone,
    character.teaDateIntroAssistantMessage,
    introTemplateUserName,
  ]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const departCafe = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    window.setTimeout(() => {
      onFinishedTeaDate();
    }, 400);
  }, [leaving, onFinishedTeaDate]);

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
    setLeaving(true);
    setError(null);
    window.setTimeout(() => {
      onInterruptTeaDate();
    }, 400);
  }, [leaving, entranceDone, userSays, onInterruptTeaDate]);

  const submitCafe = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || inputBlocked) return;

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
      messages,
      onAffinityDelta,
      onVenueTurnCompleted,
      turnsInScene,
      userName,
    ]
  );

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col bg-[#dbd2c9] backdrop-blur-sm ${
        leaving
          ? "pointer-events-none animate-scene-fade-out"
          : "animate-scene-fade-in"
      }`}
      role="dialog"
      aria-label="お茶デート・喫茶店シーン"
      aria-busy={!entranceDone}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#e8dfd6] via-[#ddd3c9] to-[#cfc4b9]" />

      <header
        className={`relative z-[1] flex shrink-0 items-center justify-between border-b border-slate-800/10 bg-[#d4cbc2]/92 px-4 py-3 text-slate-800 backdrop-blur-md shadow-sm transition-opacity duration-500 ${
          entranceDone ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-sm font-semibold tracking-wide">☕ 喫茶店</p>
        <button
          type="button"
          onClick={() => interruptCafe()}
          disabled={leaving || !entranceDone}
          className="rounded-full bg-slate-900/10 px-3 py-1.5 text-xs font-medium backdrop-blur transition hover:bg-slate-900/15 disabled:opacity-40"
        >
          店を出る（中断）
        </button>
      </header>

      {showSceneHero ? (
        <div
          className={`relative z-[1] shrink-0 px-4 pb-3 pt-4 transition-opacity duration-500 ${
            entranceDone ? "opacity-100" : "opacity-40"
          }`}
        >
          <div className="mx-auto flex w-full max-w-lg justify-center">
            <div className="relative isolate mx-auto h-[min(48vh,460px)] w-full max-w-[380px] overflow-hidden rounded-2xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)] ring-2 ring-white/70">
              {hasPairCafe && emptyCafeSrc ? (
                <Image
                  src={emptyCafeSrc}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 92vw, 380px"
                  priority
                  className="object-cover object-center"
                />
              ) : null}
              {hasPairCafe && withCafeSrc ? (
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: pairLayerVisible ? 1 : 0,
                    transitionProperty: "opacity",
                    transitionDuration: `${CAFE_PAIR_CROSS_MS}ms`,
                    transitionTimingFunction: "ease-out",
                  }}
                >
                  <Image
                    src={withCafeSrc}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 92vw, 380px"
                    priority={pairLayerVisible}
                    className="object-cover object-center"
                  />
                </div>
              ) : null}
              {resolvedSingleBg ? (
                <Image
                  src={resolvedSingleBg}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 92vw, 380px"
                  priority
                  className="object-cover object-center"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className={`scrollbar-thin relative z-[1] mx-auto min-h-0 w-full max-w-lg flex-1 space-y-3 overflow-y-auto px-4 py-3 transition-opacity duration-500 ${
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
          <p className="px-2 text-xs text-slate-600 drop-shadow-sm">
            {character.displayName}が考えています…
          </p>
        )}
        {error ? (
          <div className="rounded-xl border border-red-400/70 bg-red-50 px-3 py-2 text-xs text-red-900">
            {error}
          </div>
        ) : null}
      </div>

      <footer
        className={`relative z-[1] mx-auto mt-auto flex w-full max-w-lg shrink-0 flex-col gap-2 border-t border-slate-800/10 bg-[#d4cbc2]/90 px-3 py-3 backdrop-blur-md shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)] transition-opacity duration-500 ${
          entranceDone ? "opacity-100" : "opacity-0"
        }`}
      >
        {showLeavePrompt ? (
          <button
            type="button"
            onClick={() => departCafe()}
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
          <p className="text-center text-[11px] font-medium text-slate-700">
            あと{" "}
            <span className="font-semibold text-slate-900">
              {minTurns - turnsInScene}
            </span>{" "}
            ターンで「帰りますか」が選べます
          </p>
        ) : null}

        {turnsInScene >= maxTurns && !leaving && entranceDone ? (
          <p className="text-center text-[11px] font-medium text-slate-700">
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
