"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { HeartIndicator } from "@/components/HeartIndicator";
import { BgmToggleButton, useBgmGlobalEnabled } from "@/components/BgmPreferenceProvider";
import { MessageInput } from "@/components/MessageInput";
import { interpolateUserName } from "@/lib/promptInterpolate";
import { useProposalMomentAmbient } from "@/hooks/useProposalAmbient";
import type { AffinityPulse, Character, Message } from "@/types";

const DEFAULT_PROPOSAL_DATE_INTRO =
  "…来てくれてありがとうございます。\n少し、話したいことがあって。";

const DEFAULT_PROPOSAL_DATE_WALK =
  "……少し、歩きながら話してもいいですか。\n実は、ずっと言えなかったことがあって。";

/**
 * シーンフェーズ
 * intro  : 入場〜イントロセリフ（input 表示・ユーザーが返事を待つ）
 * walk   : ユーザーが1ターン送信後 → 歩くシーンのセリフ表示
 * proposal: walkセリフ後 → プロポーズ文 + ボタン
 * accepted: 承諾後のブレスレット→笑顔シーケンス
 */
type Phase = "intro" | "walk" | "proposal" | "accepted";

/**
 * シーン画像インデックス
 * 0: 誰もいない公園 / 1: 登場 / 2: 歩く / 3: プロポーズ真剣 / 4: ブレスレット / 5: 笑顔
 */
const SCENE = { empty: 0, arrival: 1, walk: 2, serious: 3, bracelet: 4, happy: 5 } as const;

/** walkセリフ表示からプロポーズ文が出るまでの待機（ms） */
const WALK_TO_PROPOSAL_MS = 3200;

function newMsgId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type ProposalDatePanelProps = {
  character: Character;
  affinity: number;
  affinityPulse?: AffinityPulse | null;
  introTemplateUserName: string;
  portraitSrc: string | null;
  onAccept: () => void;
  onDecline: () => void;
  /** `setLeaving(true)` と同タイミングで呼ばれる（親側の暗転用） */
  onBeforeLeave?: () => void;
};

export function ProposalDatePanel({
  character,
  affinity,
  affinityPulse,
  introTemplateUserName,
  portraitSrc,
  onAccept,
  onDecline,
  onBeforeLeave,
}: ProposalDatePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposalMsgId, setProposalMsgId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [entranceDone, setEntranceDone] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [sceneIdx, setSceneIdx] = useState<number>(SCENE.empty);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const introOnce = useRef(false);

  const bgmEnabled = useBgmGlobalEnabled();

  const scenes: string[] = character.proposalDateSceneSrcs?.length
    ? character.proposalDateSceneSrcs
    : character.proposalDateSceneSrc?.trim()
    ? [character.proposalDateSceneSrc.trim()]
    : [];
  const currentSceneSrc = scenes[sceneIdx] ?? scenes[scenes.length - 1] ?? null;

  const isProposalPhase = phase === "proposal" || phase === "accepted";
  const inputDisabled = phase !== "intro" || typing;

  useProposalMomentAmbient(entranceDone && !leaving);

  // スクロール追従
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // 入場アニメ → arrival 画像へ
  useEffect(() => {
    const id = window.setTimeout(() => {
      setEntranceDone(true);
      setSceneIdx(SCENE.arrival);
    }, 600);
    return () => window.clearTimeout(id);
  }, []);

  // イントロセリフを自動表示（entranceDone 後に1回だけ）
  useEffect(() => {
    if (!entranceDone || introOnce.current) return;
    introOnce.current = true;

    const introSource =
      character.proposalDateIntroAssistantMessage?.trim() || DEFAULT_PROPOSAL_DATE_INTRO;
    const introText = interpolateUserName(introSource, introTemplateUserName);

    setMessages([
      {
        id: newMsgId(),
        role: "assistant",
        content: introText,
        createdAt: Date.now(),
      },
    ]);
  }, [entranceDone, character.proposalDateIntroAssistantMessage, introTemplateUserName]);

  // ユーザーがメッセージを送信（intro フェーズのみ）
  const handleSubmit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || inputDisabled) return;

      if (bgmEnabled) {
        try {
          const se = new Audio("/audio/send.mp3");
          se.volume = 0.5;
          void se.play();
        } catch { /* ignore */ }
      }

      // ユーザーメッセージを追加
      const userMsg: Message = {
        id: newMsgId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setTyping(true);
      setSceneIdx(SCENE.walk);

      // 少し間を置いてから walk セリフ表示
      window.setTimeout(() => {
        const walkSource =
          character.proposalDateWalkAssistantMessage?.trim() || DEFAULT_PROPOSAL_DATE_WALK;
        const walkText = interpolateUserName(walkSource, introTemplateUserName);
        const walkMsg: Message = {
          id: newMsgId(),
          role: "assistant",
          content: walkText,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, walkMsg]);
        setTyping(false);
        setPhase("walk");

        // WALK_TO_PROPOSAL_MS 後にプロポーズ文を表示
        window.setTimeout(() => {
          const proposalSource = character.proposalMessage?.trim() ?? "";
          if (!proposalSource) return;
          const proposalText = interpolateUserName(proposalSource, introTemplateUserName);
          const aid = newMsgId();
          setMessages((prev) => [
            ...prev,
            {
              id: aid,
              role: "assistant",
              content: proposalText,
              createdAt: Date.now(),
              proposalChoices: true,
            },
          ]);
          setProposalMsgId(aid);
          setPhase("proposal");
          setSceneIdx(SCENE.serious);
        }, WALK_TO_PROPOSAL_MS);
      }, 1600);
    },
    [
      inputDisabled,
      bgmEnabled,
      character.proposalDateWalkAssistantMessage,
      character.proposalMessage,
      introTemplateUserName,
    ]
  );

  const handleAccept = () => {
    if (bgmEnabled) {
      try {
        const se = new Audio("/audio/proposal-accept.mp3");
        se.volume = 0.7;
        void se.play();
      } catch { /* ignore */ }
    }
    setPhase("accepted");
    // ブレスレット → 笑顔 → エンディング
    setSceneIdx(SCENE.bracelet);
    window.setTimeout(() => setSceneIdx(SCENE.happy), 2500);
    window.setTimeout(() => {
      onBeforeLeave?.();
      setLeaving(true);
    }, 4800);
    window.setTimeout(() => onAccept(), 5200);
  };

  const handleDecline = () => {
    if (bgmEnabled) {
      try {
        const se = new Audio("/audio/proposal-decline.mp3");
        se.volume = 0.6;
        void se.play();
      } catch { /* ignore */ }
    }
    onBeforeLeave?.();
    setLeaving(true);
    window.setTimeout(() => onDecline(), 350);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col bg-[#f5f0eb] ${
        leaving
          ? "pointer-events-none animate-scene-fade-out"
          : "animate-scene-fade-in"
      }`}
      role="dialog"
      aria-label="プロポーズデートシーン"
      aria-busy={!entranceDone}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#f0e8e0] via-[#ede5dc] to-[#e8ddd2]" />

      {/* ヘッダー：3カラム（名前 / ハート / BGM） */}
      <header
        className={`relative z-10 grid min-h-[3.25rem] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 border-b border-rose-200/40 bg-[#ede5dc]/95 px-3 py-2 shadow-sm backdrop-blur-md transition-opacity duration-700 sm:px-4 ${
          entranceDone ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* 左：キャラ名 */}
        <div className="flex min-w-0 items-center gap-2">
          {portraitSrc ? (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-rose-300/40">
              <Image
                src={portraitSrc}
                alt={character.name}
                fill
                sizes="32px"
                className="object-cover object-top"
              />
            </div>
          ) : null}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-slate-800">
              {character.name}
            </p>
            <p className="truncate text-[10px] text-rose-400/80">
              💍 プロポーズ
            </p>
          </div>
        </div>
        {/* 中央：ハート */}
        <div className="flex justify-center">
          <HeartIndicator affinity={affinity} pulse={affinityPulse ?? null} />
        </div>
        {/* 右：BGM */}
        <div className="flex min-w-0 items-center justify-end">
          <BgmToggleButton />
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* シーン画像 */}
        <div
          className={`shrink-0 px-3 pb-1.5 pt-2 transition-opacity duration-700 sm:px-4 sm:pb-2 sm:pt-3 ${
            entranceDone ? "opacity-100" : "opacity-40"
          }`}
        >
          <div
            className="relative isolate mx-auto h-[min(26vh,200px)] overflow-hidden rounded-2xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.22)] ring-1 ring-rose-200/50 sm:h-[min(36vh,320px)]"
            style={{ maxWidth: "min(92vw, 420px)" }}
          >
            {currentSceneSrc ? (
              <>
                <Image
                  key={currentSceneSrc}
                  src={currentSceneSrc}
                  alt="プロポーズデート"
                  fill
                  sizes="(max-width: 768px) 92vw, 420px"
                  priority
                  className="object-cover object-center transition-opacity duration-700"
                />
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#f5f0eb]/60 to-transparent" />
              </>
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-rose-50 to-amber-50">
                <p className="text-4xl opacity-30">💍</p>
              </div>
            )}
          </div>
        </div>

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
              proposalActions={
                m.proposalChoices && m.id === proposalMsgId
                  ? { onAccept: handleAccept, onDecline: handleDecline }
                  : undefined
              }
            />
          ))}
          {/* タイピングインジケータ */}
          {typing ? (
            <div className="flex items-center gap-1.5 px-2 text-xs text-slate-400">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300" />
              </span>
              <span>{character.displayName}が言葉を選んでいます…</span>
            </div>
          ) : null}
          {/* walk→proposalの待機インジケータ */}
          {phase === "walk" && !typing ? (
            <div className="flex items-center gap-1.5 px-2 text-xs text-slate-400">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300" />
              </span>
              <span>{character.displayName}が続きを話そうとしています…</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* フッター：intro フェーズは入力欄、それ以外は案内文 */}
      <footer
        className={`relative z-10 shrink-0 border-t border-rose-200/30 bg-[#ede5dc]/95 px-3 py-3 backdrop-blur-md transition-opacity duration-700 ${
          entranceDone ? "opacity-100" : "opacity-0"
        }`}
      >
        {phase === "intro" ? (
          <MessageInput
            onSubmit={handleSubmit}
            disabled={inputDisabled}
            placeholder={`${character.displayName}に返事をする…`}
          />
        ) : isProposalPhase ? (
          <p className="text-center text-xs text-rose-400/70 italic">
            大切な返事をしてください
          </p>
        ) : (
          <p className="text-center text-xs text-slate-400 italic">
            …{character.displayName}が続きを話しています
          </p>
        )}
      </footer>
    </div>
  );
}
