"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { BgmToggleButton, useBgmGlobalEnabled } from "@/components/BgmPreferenceProvider";
import { ChatBubble } from "@/components/ChatBubble";
import { HeartIndicator } from "@/components/HeartIndicator";
import { MessageInput } from "@/components/MessageInput";
import { assistantTypingDelayMs, sleepMs } from "@/lib/replyLatency";
import type { AffinityPulse, Character, Message } from "@/types";

const OVERNIGHT_BLACKOUT_MS = 5000;
const OVERNIGHT_MORNING_HERO_SRC = "/characters/hanasaki/morning_after.png";
const OVERNIGHT_BLACKOUT_SE_SRC = "/audio/overnight-blackout.mp3";

const MORNING_OPENERS = [
  "おはよう。……髪、ちょっと跳ねてるね。\n昨日は、本当に素敵な夜だった。",
  "おはよう、よく眠れた？\n……昨日の時間、すごく幸せだった。",
];
const MORNING_FOLLOWUPS = [
  "……その寝癖、反則だね。朝から可愛すぎる。",
  "カーテン越しの光、君に似合うな。見惚れてた。",
];
const MORNING_REPLIES = [
  "おはよう。照れてる君も、ちゃんと好きだよ。",
  "おはよう。そんな顔されると、もう少し困らせたくなるな。",
];

type Stage = "boot" | "awaitingFirstUser" | "awaitingSecondUser" | "leaving";

function newMsgId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type OvernightStayPanelProps = {
  character: Character;
  affinity: number;
  affinityPulse?: AffinityPulse | null;
  portraitSrc: string | null;
  onAffinityDelta: (delta: number) => void;
  onFinishedOvernightStay: () => void;
  onBeforeLeave?: () => void;
};

export function OvernightStayPanel({
  character,
  affinity,
  affinityPulse,
  portraitSrc,
  onAffinityDelta,
  onFinishedOvernightStay,
  onBeforeLeave,
}: OvernightStayPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [stage, setStage] = useState<Stage>("boot");
  const [sending, setSending] = useState(false);
  const [blackout, setBlackout] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgmEnabled = useBgmGlobalEnabled();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (bgmEnabled) {
        try {
          const se = new Audio(OVERNIGHT_BLACKOUT_SE_SRC);
          se.volume = 0.55;
          se.loop = false;
          audioRef.current = se;
          void se.play();
        } catch {
          // ignore
        }
      }
      await sleepMs(OVERNIGHT_BLACKOUT_MS);
      if (cancelled) return;
      const current = audioRef.current;
      if (current) {
        try {
          current.pause();
          current.currentTime = 0;
        } catch {
          // ignore
        }
        audioRef.current = null;
      }
      setBlackout(false);

      const opener =
        MORNING_OPENERS[Math.floor(Math.random() * MORNING_OPENERS.length)] ??
        MORNING_OPENERS[0];
      setMessages((prev) => [
        ...prev,
        {
          id: newMsgId(),
          role: "assistant",
          content: opener,
          createdAt: Date.now(),
        },
      ]);
      const followDelay = Math.max(
        420,
        Math.round(assistantTypingDelayMs(character, affinity) * 0.65)
      );
      await sleepMs(followDelay);
      if (cancelled) return;
      const followup =
        MORNING_FOLLOWUPS[Math.floor(Math.random() * MORNING_FOLLOWUPS.length)] ??
        MORNING_FOLLOWUPS[0];
      setMessages((prev) => [
        ...prev,
        {
          id: newMsgId(),
          role: "assistant",
          content: followup,
          createdAt: Date.now(),
        },
      ]);
      setStage("awaitingFirstUser");
    };
    void run();
    return () => {
      cancelled = true;
      const current = audioRef.current;
      if (current) {
        try {
          current.pause();
          current.currentTime = 0;
        } catch {
          // ignore
        }
      }
      audioRef.current = null;
    };
  }, [affinity, bgmEnabled, character]);

  const placeholder = useMemo(() => {
    if (stage === "boot") return "朝が来るまで…";
    if (stage === "awaitingFirstUser") return "「おはよう」と返してみる…";
    if (stage === "awaitingSecondUser") return "もうひとこと返すとLINEに戻る…";
    return "シーン移行中…";
  }, [stage]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || stage === "boot" || stage === "leaving") return;
    const userMsg: Message = {
      id: newMsgId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (stage === "awaitingFirstUser") {
      setSending(true);
      const reply =
        MORNING_REPLIES[Math.floor(Math.random() * MORNING_REPLIES.length)] ??
        MORNING_REPLIES[0];
      const wait = assistantTypingDelayMs(character, affinity);
      if (wait > 0) await sleepMs(wait);
      setMessages((prev) => [
        ...prev,
        {
          id: newMsgId(),
          role: "assistant",
          content: reply,
          createdAt: Date.now(),
        },
      ]);
      setStage("awaitingSecondUser");
      setSending(false);
      return;
    }
    if (stage === "awaitingSecondUser") {
      setStage("leaving");
      onBeforeLeave?.();
      setLeaving(true);
      onAffinityDelta(2);
      window.setTimeout(() => {
        onFinishedOvernightStay();
      }, 380);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col bg-slate-950 ${
        leaving ? "pointer-events-none animate-scene-fade-out" : "animate-scene-fade-in"
      }`}
      role="dialog"
      aria-label="お泊まり・翌朝シーン"
    >
      <div
        className="pointer-events-none absolute inset-0 z-[140] bg-black transition-opacity duration-500"
        style={{ opacity: blackout ? 1 : 0 }}
      />
      <header className="relative z-10 grid min-h-[3.25rem] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 border-b border-white/15 bg-black/50 px-3 py-2 text-white backdrop-blur-md shadow-sm sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {portraitSrc ? (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-rose-300/30">
              <Image src={portraitSrc} alt={character.name} fill sizes="32px" className="object-cover object-top" />
            </div>
          ) : null}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{character.name}</p>
            <p className="truncate text-[10px] text-rose-200/70">🌙 お泊まりの朝</p>
          </div>
        </div>
        <div className="flex justify-center">
          <HeartIndicator affinity={affinity} pulse={affinityPulse ?? null} />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <BgmToggleButton />
        </div>
      </header>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-3 pb-1.5 pt-2 sm:px-4 sm:pb-2 sm:pt-3">
          <div className="relative isolate mx-auto h-[min(30vh,260px)] overflow-hidden rounded-2xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.42)] ring-1 ring-white/20 sm:h-[min(36vh,320px)]" style={{ maxWidth: "min(92vw, 420px)" }}>
            <Image
              src={OVERNIGHT_MORNING_HERO_SRC}
              alt="朝の花咲さん"
              fill
              sizes="(max-width: 768px) 92vw, 420px"
              className="object-contain object-center scale-[0.9] sm:scale-100"
              priority
            />
          </div>
        </div>
        <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
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
            <p className="px-2 text-xs text-white/80 drop-shadow">
              {character.displayName}が考えています…
            </p>
          ) : null}
        </div>
      </div>

      <footer className="relative z-10 mt-auto shrink-0 border-t border-white/15 bg-black/55 px-3 py-3 backdrop-blur-md">
        <MessageInput onSubmit={(t) => void submit(t)} disabled={stage === "boot" || stage === "leaving" || sending} placeholder={placeholder} />
      </footer>
    </div>
  );
}
