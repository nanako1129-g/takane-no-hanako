"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { HeartIndicator } from "@/components/HeartIndicator";
import { BgmToggleButton } from "@/components/BgmPreferenceProvider";
import { interpolateUserName } from "@/lib/promptInterpolate";
import { useProposalMomentAmbient } from "@/hooks/useProposalAmbient";
import type { AffinityPulse, Character, Message } from "@/types";

const DEFAULT_PROPOSAL_DATE_INTRO =
  "…来てくれてありがとうございます。\n少し、話したいことがあって。";

/** イントロ表示から提案文表示までの間（ms） */
const PROPOSAL_AUTO_DELAY_MS = 2800;

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const introOnce = useRef(false);

  const proposalPending = proposalMsgId !== null;
  const sceneSrc = character.proposalDateSceneSrc?.trim() ?? null;

  useProposalMomentAmbient(entranceDone && !leaving);

  // スクロール追従
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // 入場アニメ
  useEffect(() => {
    const id = window.setTimeout(() => setEntranceDone(true), 600);
    return () => window.clearTimeout(id);
  }, []);

  // イントロ → プロポーズを自動表示
  useEffect(() => {
    if (!entranceDone || introOnce.current) return;
    introOnce.current = true;

    const introSource =
      character.proposalDateIntroAssistantMessage?.trim() ||
      DEFAULT_PROPOSAL_DATE_INTRO;
    const introText = interpolateUserName(introSource, introTemplateUserName);

    const introMsg: Message = {
      id: newMsgId(),
      role: "assistant",
      content: introText,
      createdAt: Date.now(),
    };
    setMessages([introMsg]);

    // PROPOSAL_AUTO_DELAY_MS 後にプロポーズ文を表示
    const pid = window.setTimeout(() => {
      const proposalSource = character.proposalMessage?.trim() ?? "";
      if (!proposalSource) return;
      const proposalText = interpolateUserName(proposalSource, introTemplateUserName);
      const aid = newMsgId();
      const proposalMsg: Message = {
        id: aid,
        role: "assistant",
        content: proposalText,
        createdAt: Date.now(),
        proposalChoices: true,
      };
      setMessages((prev) => [...prev, proposalMsg]);
      setProposalMsgId(aid);
    }, PROPOSAL_AUTO_DELAY_MS);

    return () => window.clearTimeout(pid);
  }, [
    entranceDone,
    character.proposalDateIntroAssistantMessage,
    character.proposalMessage,
    introTemplateUserName,
  ]);

  const handleAccept = () => {
    onBeforeLeave?.();
    setLeaving(true);
    window.setTimeout(() => onAccept(), 350);
  };

  const handleDecline = () => {
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
        {/* シーン画像（中央に配置） */}
        {sceneSrc ? (
          <div
            className={`shrink-0 px-3 pb-1.5 pt-2 transition-opacity duration-700 sm:px-4 sm:pb-2 sm:pt-3 ${
              entranceDone ? "opacity-100" : "opacity-40"
            }`}
          >
            <div
              className="relative isolate mx-auto h-[min(26vh,200px)] overflow-hidden rounded-2xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.22)] ring-1 ring-rose-200/50 sm:h-[min(36vh,320px)]"
              style={{ maxWidth: "min(92vw, 420px)" }}
            >
              <Image
                src={sceneSrc}
                alt="プロポーズデート"
                fill
                sizes="(max-width: 768px) 92vw, 420px"
                priority
                className="object-cover object-center"
              />
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#f5f0eb]/60 to-transparent" />
            </div>
          </div>
        ) : (
          /* 画像未設定のプレースホルダー */
          <div
            className={`shrink-0 px-3 pb-1.5 pt-2 transition-opacity duration-700 sm:px-4 sm:pb-2 sm:pt-3 ${
              entranceDone ? "opacity-100" : "opacity-40"
            }`}
          >
            <div
              className="relative isolate mx-auto flex h-[min(26vh,200px)] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] ring-1 ring-rose-200/50 sm:h-[min(36vh,320px)]"
              style={{ maxWidth: "min(92vw, 420px)" }}
            >
              <p className="text-4xl opacity-30">💍</p>
            </div>
          </div>
        )}

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
          {/* プロポーズ文が出るまでの待機インジケータ */}
          {entranceDone && !proposalPending && messages.length > 0 ? (
            <div className="flex items-center gap-1.5 px-2 text-xs text-slate-400">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-300" />
              </span>
              <span>{character.displayName}が言葉を選んでいます…</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* フッター（プロポーズ前は静かに待つ） */}
      <footer
        className={`relative z-10 shrink-0 border-t border-rose-200/30 bg-[#ede5dc]/95 px-3 py-3 text-center backdrop-blur-md transition-opacity duration-700 ${
          entranceDone ? "opacity-100" : "opacity-0"
        }`}
      >
        {!proposalPending ? (
          <p className="text-xs text-slate-400 italic">
            …{character.displayName}が話し始めるのを待っています
          </p>
        ) : (
          <p className="text-xs text-rose-400/70 italic">
            大切な返事をしてください
          </p>
        )}
      </footer>
    </div>
  );
}
