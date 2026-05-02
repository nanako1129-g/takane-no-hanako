"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { MessageInput } from "@/components/MessageInput";
import { messageContentForGemini } from "@/lib/stamps";
import { assistantTypingDelayMs, sleepMs } from "@/lib/replyLatency";
import { interpolateUserName } from "@/lib/promptInterpolate";
import type { Character, ChatResponseBody, Message } from "@/types";

/** 共通テロップ（`CharacterConfig.barDateLocationTelop` で上書き可） */
const DEFAULT_BAR_LOCATION_TELOP = "— at Bar Polaris, 六本木 —";

const DEFAULT_BAR_VENUE_INTRO = "{userName}さん、お疲れさまです…";

const WHITE_IN_MS = 420;
const TELOP_MS = 2180;
const WHITE_OUT_MS = 760;
/** 無人個室のみ表示後、相手登場フェードまで */
const SOLO_HOLD_MS = 620;
/** 相手レイヤーを重ねる時間 */
const PAIR_CROSS_MS = 900;
const POST_AMBIENT_MS = 220;

function newMsgId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type BarVenuePanelProps = {
  character: Character;
  affinity: number;
  userName: string;
  introTemplateUserName: string;
  portraitSrc: string | null;
  hidePortraitStrip?: boolean;
  turnsInScene: number;
  minTurns: number;
  maxTurns: number;
  onVenueTurnCompleted: () => void;
  onAffinityDelta: (delta: number) => void;
  onFinishedBarDate: () => void;
  onInterruptBarDate: () => void;
};

export function BarVenuePanel({
  character,
  affinity,
  userName,
  introTemplateUserName,
  portraitSrc,
  hidePortraitStrip,
  turnsInScene,
  minTurns,
  maxTurns,
  onVenueTurnCompleted,
  onAffinityDelta,
  onFinishedBarDate,
  onInterruptBarDate,
}: BarVenuePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const departRef = useRef<() => void>(() => {});
  const introOnce = useRef(false);

  const emptySrc = character.barDateEmptyBackgroundSrc?.trim();
  const withSrc = character.barDateWithCharacterBackgroundSrc?.trim();
  const hasPairBg = Boolean(emptySrc && withSrc);
  /** 無人フェーズ無し・乾杯パネルだけ（`bar_empty` 未定義） */
  const hasSoloBarBg = Boolean(withSrc && !emptySrc);
  const telopLine =
    character.barDateLocationTelop?.trim() || DEFAULT_BAR_LOCATION_TELOP;

  const [entranceDone, setEntranceDone] = useState(false);
  const [whiteVeilGone, setWhiteVeilGone] = useState(false);
  const [telopVisible, setTelopVisible] = useState(false);
  const [pairLayerVisible, setPairLayerVisible] = useState(!hasPairBg);

  const userSays = messages.filter((m) => m.role === "user").length;
  const showLeavePrompt =
    entranceDone &&
    turnsInScene >= minTurns &&
    turnsInScene < maxTurns &&
    !leaving;
  const inputBlocked =
    !entranceDone || sending || leaving || turnsInScene >= maxTurns;

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

    after(WHITE_IN_MS, () => setTelopVisible(true));

    after(WHITE_IN_MS + TELOP_MS, () => {
      setTelopVisible(false);
      setWhiteVeilGone(true);
    });

    const sceneRevealedAt = WHITE_IN_MS + TELOP_MS + WHITE_OUT_MS;

    if (hasPairBg) {
      after(sceneRevealedAt + SOLO_HOLD_MS, () => setPairLayerVisible(true));
      after(
        sceneRevealedAt +
          SOLO_HOLD_MS +
          PAIR_CROSS_MS +
          POST_AMBIENT_MS,
        () => setEntranceDone(true)
      );
    } else {
      after(sceneRevealedAt + POST_AMBIENT_MS, () => setEntranceDone(true));
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [hasPairBg]);

  useEffect(() => {
    if (!entranceDone || introOnce.current) return;
    introOnce.current = true;
    const introSource =
      character.barIntroAssistantMessage?.trim() || DEFAULT_BAR_VENUE_INTRO;
    const firstLineBar = interpolateUserName(
      introSource,
      introTemplateUserName
    );
    setMessages([
      {
        id: newMsgId(),
        role: "assistant",
        content: firstLineBar,
        createdAt: Date.now(),
      },
    ]);
  }, [entranceDone, character.barIntroAssistantMessage, introTemplateUserName]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const depart = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    window.setTimeout(() => {
      onFinishedBarDate();
    }, 400);
  }, [leaving, onFinishedBarDate]);

  departRef.current = depart;

  useEffect(() => {
    if (turnsInScene < maxTurns || leaving) return;
    const id = window.setTimeout(() => {
      departRef.current();
    }, 700);
    return () => window.clearTimeout(id);
  }, [turnsInScene, maxTurns, leaving]);

  const interrupt = useCallback(() => {
    if (leaving || !entranceDone) return;
    if (
      userSays > 0 &&
      typeof window !== "undefined" &&
      !window.confirm(
        "個室バーを出ます。飲みのお誘いはそのまま残ります（追加のカウントはありません）。"
      )
    ) {
      return;
    }
    setLeaving(true);
    setError(null);
    window.setTimeout(() => {
      onInterruptBarDate();
    }, 400);
  }, [leaving, entranceDone, userSays, onInterruptBarDate]);

  const submitBar = useCallback(
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
          character,
          affinity,
          userName,
          teaDateBar: true,
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

  const whiteFadeOutMs = whiteVeilGone ? WHITE_OUT_MS : 0;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col bg-slate-950/40 backdrop-blur-sm ${
        leaving
          ? "pointer-events-none animate-scene-fade-out"
          : "animate-scene-fade-in"
      }`}
      role="dialog"
      aria-label="バー・飲みデートシーン"
      aria-busy={!entranceDone}
    >
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900" />
      {hasSoloBarBg && withSrc ? (
        <div className="absolute inset-0 -z-10">
          <Image
            src={withSrc}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover object-center"
          />
        </div>
      ) : null}
      {hasPairBg && emptySrc ? (
        <div className="absolute inset-0 -z-14">
          <Image
            src={emptySrc}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover object-center"
          />
        </div>
      ) : null}
      {hasPairBg && withSrc ? (
        <div
          className="absolute inset-0 -z-12"
          style={{
            opacity: pairLayerVisible ? 1 : 0,
            transitionProperty: "opacity",
            transitionDuration: `${PAIR_CROSS_MS}ms`,
            transitionTimingFunction: "ease-out",
          }}
        >
          <Image
            src={withSrc}
            alt=""
            fill
            sizes="100vw"
            priority={pairLayerVisible}
            className="object-cover object-center"
          />
        </div>
      ) : null}
      <div className="absolute inset-0 -z-[5] bg-[radial-gradient(ellipse_at_top,_rgba(251,113,133,0.12),_transparent_55%)]" />
      <div className="absolute inset-0 -z-[5] bg-gradient-to-t from-black/50 via-transparent to-indigo-500/15" />

      <div
        className={`pointer-events-none absolute inset-0 z-[140] bg-white transition-opacity ease-out`}
        style={{
          opacity: whiteVeilGone ? 0 : 1,
          transitionDuration: `${whiteFadeOutMs}ms`,
        }}
      />

      <div
        className={`pointer-events-none absolute inset-0 z-[160] flex items-center justify-center px-8 transition-opacity duration-500 ease-out ${
          telopVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-center text-sm font-semibold italic tracking-[0.18em] text-slate-600 drop-shadow-sm">
          {telopLine}
        </p>
      </div>

      <header
        className={`flex shrink-0 items-center justify-between border-b border-white/25 bg-black/35 px-4 py-3 text-white backdrop-blur-md transition-opacity duration-700 ${
          entranceDone ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-sm font-semibold tracking-wide">🍷 Bar Polaris（個室）</p>
        <button
          type="button"
          onClick={() => interrupt()}
          disabled={leaving || !entranceDone}
          className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur transition hover:bg-white/25 disabled:opacity-40"
        >
          退室（中断）
        </button>
      </header>

      <div
        ref={scrollRef}
        className={`scrollbar-thin mx-auto mt-3 min-h-0 w-full max-w-lg flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-2 transition-opacity duration-700 ${
          entranceDone ? "opacity-100" : "opacity-0"
        }`}
      >
        {portraitSrc && !hidePortraitStrip ? (
          <div className="mx-auto mb-4 w-32 overflow-hidden rounded-2xl shadow-lg ring-2 ring-rose-200/35">
            <div className="relative aspect-[3/4] w-full bg-gradient-to-br from-white/10 to-transparent">
              <Image
                src={portraitSrc}
                alt={character.name}
                fill
                className="object-cover object-top"
                sizes="128px"
              />
            </div>
          </div>
        ) : null}

        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            characterName={character.displayName}
            characterAvatarSrc={portraitSrc ?? undefined}
            characterAvatarAlt={character.name}
          />
        ))}
        {sending ? (
          <p className="px-2 text-xs text-white/90 drop-shadow">
            {character.displayName}が考えています…
          </p>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-300/70 bg-red-950/70 px-3 py-2 text-xs text-red-50">
            {error}
          </div>
        ) : null}
      </div>

      <footer
        className={`mx-auto mt-auto flex w-full max-w-lg shrink-0 flex-col gap-2 border-t border-white/25 bg-black/40 px-3 py-3 backdrop-blur-md transition-opacity duration-700 ${
          entranceDone ? "opacity-100" : "opacity-0"
        }`}
      >
        {showLeavePrompt ? (
          <button
            type="button"
            onClick={() => depart()}
            disabled={leaving}
            className="w-full rounded-2xl border border-rose-300/60 bg-gradient-to-r from-slate-800/95 to-indigo-900/90 px-4 py-3 text-sm font-semibold text-rose-50 shadow-sm transition hover:border-rose-200/70 disabled:opacity-50"
          >
            🚪 そろそろ帰る
          </button>
        ) : null}

        {turnsInScene >= minTurns &&
        turnsInScene < maxTurns &&
        !leaving &&
        !showLeavePrompt &&
        entranceDone ? (
          <p className="text-center text-[11px] font-medium text-rose-100/85">
            あと{" "}
            <span className="font-semibold text-rose-50">
              {minTurns - turnsInScene}
            </span>{" "}
            ターンで「帰る」が選べます
          </p>
        ) : null}

        {turnsInScene >= maxTurns && !leaving && entranceDone ? (
          <p className="text-center text-[11px] font-medium text-rose-100/90">
            今夜はゆっくり話せてよかった。また連絡するね…（自動で退席）
          </p>
        ) : null}

        <MessageInput
          onSubmit={(t) => void submitBar(t)}
          disabled={inputBlocked}
          placeholder={
            !entranceDone
              ? "シーン移行中…"
              : turnsInScene >= maxTurns
              ? "このバーでの会話はおしまいです"
              : `個室バーで話す（残り ${maxTurns - turnsInScene} ターン）`
          }
        />
      </footer>
    </div>
  );
}
