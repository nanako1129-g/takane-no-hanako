"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AffinityBar } from "@/components/AffinityBar";
import { ChatBubble } from "@/components/ChatBubble";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { MessageInput } from "@/components/MessageInput";
import { StampPicker } from "@/components/StampPicker";
import {
  getCharacter,
  pickCharacterPortrait,
} from "@/characters";
import { clearCachedAnalysis } from "@/lib/analysisCache";
import {
  messageContentForGemini,
  getStamp as getStampFromCatalog,
  stamps as stampDefinitions,
} from "@/lib/stamps";
import { useAffinity } from "@/hooks/useAffinity";
import type {
  ChatMode,
  ChatResponseBody,
  Message,
  SceneEvent,
} from "@/types";

export interface ChatExperienceProps {
  charId: string;
  /** 現状は `line` のみ。scene / call はレイアウト・フックのみ先行 */
  mode?: ChatMode;
  /** scene モード時のイベント差し込み用（データ属性のみ。処理は将来） */
  sceneEvent?: SceneEvent | null;
}

const MESSAGES_PREFIX = "messages_";

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ChatExperience({
  charId,
  mode = "line",
  sceneEvent = null,
}: ChatExperienceProps) {
  const character = getCharacter(charId);
  if (!character) notFound();

  const router = useRouter();
  const { affinity, applyChange, reset, hydrated } = useAffinity(
    character.id,
    character.initialAffinity
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(
        `${MESSAGES_PREFIX}${character.id}`
      );
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore
    }
    setHistoryHydrated(true);
  }, [character.id]);

  useEffect(() => {
    if (!historyHydrated) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `${MESSAGES_PREFIX}${character.id}`,
        JSON.stringify(messages)
      );
    } catch {
      // ignore
    }
  }, [messages, character.id, historyHydrated]);

  useEffect(() => {
    if (!historyHydrated) return;
    if (messages.length > 0) return;
    setMessages([
      {
        id: newId(),
        role: "assistant",
        content: character.greeting,
        createdAt: Date.now(),
      },
    ]);
  }, [historyHydrated, messages.length, character.greeting]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const sendUserRound = useCallback(
    async (userMsg: Message) => {
      setError(null);
      setSending(true);

      const historyForApi = messages.map((m) => ({
        role: m.role,
        content: messageContentForGemini(m),
      }));

      setMessages((prev) => [...prev, userMsg]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            charId: character.id,
            messages: historyForApi,
            userMessage: messageContentForGemini(userMsg),
            affinity,
          }),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as ChatResponseBody;

        const assistantMsg: Message = {
          id: newId(),
          role: "assistant",
          content: data.reply,
          inner: data.inner || undefined,
          affinityChange: data.affinityChange ?? 0,
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        if (typeof data.affinityChange === "number") {
          applyChange(data.affinityChange);
        }
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "通信に失敗しました。もう一度お試しください。"
        );
      } finally {
        setSending(false);
      }
    },
    [affinity, applyChange, character.id, messages]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: Message = {
        id: newId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };

      await sendUserRound(userMsg);
    },
    [sendUserRound]
  );

  const handleStampPick = useCallback(
    async (stampId: string) => {
      const def = getStampFromCatalog(stampId);
      if (!def) return;

      const userMsg: Message = {
        id: newId(),
        role: "user",
        content: "",
        stampId: def.id,
        stampLabel: def.label,
        createdAt: Date.now(),
      };

      await sendUserRound(userMsg);
    },
    [sendUserRound]
  );

  const handleReset = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("会話履歴と好感度をリセットします。よろしいですか？")
    ) {
      return;
    }
    setMessages([]);
    reset();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`${MESSAGES_PREFIX}${character.id}`);
      clearCachedAnalysis(character.id);
    }
  }, [character.id, reset]);

  const goAnalyze = useCallback(() => {
    router.push(`/analysis/${character.id}`);
  }, [character.id, router]);

  const userMessageCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages]
  );

  const headerPortraitSrc = pickCharacterPortrait(character, affinity);

  const shellToneClass =
    mode === "scene" ? "bg-rose-50/40" : "bg-rose-50/40";

  return (
    <main
      data-chat-root
      data-chat-mode={mode}
      {...(sceneEvent?.id
        ? { "data-scene-event-id": sceneEvent.id }
        : {})}
      className={`relative mx-auto grid h-dvh w-full max-w-full grid-rows-[auto_1fr] bg-rose-50/40 md:max-w-6xl md:grid-cols-[2fr_3fr] md:grid-rows-1 ${shellToneClass}`}
    >
      {mode === "scene" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          data-scene-background-slot="reserved"
          data-scene-background-image={sceneEvent?.backgroundImage ?? ""}
          data-scene-character-image={sceneEvent?.characterImage ?? ""}
          data-scene-location={sceneEvent?.location ?? ""}
          data-scene-intro-message={sceneEvent?.introMessage ?? ""}
          data-scene-trigger-affinity={
            sceneEvent?.triggerAffinity != null
              ? String(sceneEvent.triggerAffinity)
              : ""
          }
          data-scene-system-prompt-override={
            sceneEvent?.systemPromptOverride ?? ""
          }
        />
      ) : null}

      {/* モバイル: 上に立ち絵 40vh / PC: 左カラム */}
      <aside className="flex h-[40vh] shrink-0 items-center justify-center border-b border-rose-100 bg-gradient-to-b from-white to-rose-50/70 px-3 py-2 md:h-full md:min-h-0 md:border-b-0 md:border-r md:bg-gradient-to-br md:from-white md:to-rose-50/80">
        <div className="w-[min(100%,calc(40vh*9/16))] max-h-[40vh] shrink-0 md:max-h-[min(85vh,720px)] md:w-full md:max-w-[320px]">
          <CharacterPortrait affinity={affinity} character={character} />
        </div>
      </aside>

      {/* チャット本体 */}
      <section className="flex min-h-0 flex-col overflow-hidden bg-rose-50/40">
        <header className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-rose-100 bg-white/90 px-4 py-3 backdrop-blur">
          <Link
            href="/"
            className="rounded-full px-2 py-1 text-sm text-slate-500 transition hover:bg-rose-50 hover:text-rose-500"
            aria-label="ホームに戻る"
          >
            ‹
          </Link>
          <div className="flex flex-1 items-center gap-2">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-rose-100 to-pink-200 ring-1 ring-rose-100">
              {headerPortraitSrc ? (
                <Image
                  src={headerPortraitSrc}
                  alt={character.name}
                  fill
                  sizes="40px"
                  className="object-cover object-top transition-opacity duration-500"
                  key={headerPortraitSrc}
                />
              ) : null}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-800">
                {character.name}
              </p>
              <p className="text-[11px] text-slate-500">
                {character.occupation}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 transition hover:border-rose-200 hover:text-rose-500"
          >
            リセット
          </button>
        </header>

        <div className="shrink-0 px-4 pb-2 pt-3">
          <AffinityBar value={affinity} />
        </div>

        <div
          ref={scrollRef}
          className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-2"
        >
          {!historyHydrated || !hydrated ? (
            <p className="py-8 text-center text-xs text-slate-400">
              読み込み中…
            </p>
          ) : (
            messages.map((m) => (
              <ChatBubble
                key={m.id}
                message={m}
                characterName={character.displayName}
                characterAvatarSrc={headerPortraitSrc ?? undefined}
                characterAvatarAlt={character.name}
              />
            ))
          )}
          {sending && (
            <div className="flex items-center gap-2 px-1 text-xs text-slate-400">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300" />
              </span>
              <span>{character.displayName}が考えています…</span>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <footer
          className="shrink-0 space-y-2 border-t border-rose-100 bg-white/90 p-3 backdrop-blur"
          data-chat-footer
          data-input-mode={mode}
        >
          <StampPicker
            stamps={stampDefinitions}
            disabled={sending}
            onPick={handleStampPick}
          />
          {mode === "call" ? (
            <div
              className="sr-only"
              aria-hidden
              data-voice-input-slot="reserved"
            />
          ) : null}
          <MessageInput
            onSubmit={sendMessage}
            disabled={sending}
            placeholder={
              mode === "call"
                ? "通話モードは暫定でテキスト入力（音声は今後対応）"
                : "メッセージを入力…"
            }
          />
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] text-slate-400">
              あなたの発言: {userMessageCount} 件
            </p>
            <button
              type="button"
              onClick={goAnalyze}
              disabled={userMessageCount < 1}
              className="rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              分析する →
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
