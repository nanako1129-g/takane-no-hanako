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

/** 雑談1ターン目（夜景の話） */
const DEFAULT_SMALLTALK_1 =
  "夜景、綺麗ですね。\nこういう場所、好きなんです。";

/** 雑談2ターン目 → 聞いてもらえますか */
const DEFAULT_SMALLTALK_2 =
  "…少し、聞いてもらえますか？";

const DEFAULT_PROPOSAL_DATE_WALK =
  "……少し、歩きながら話してもいいですか。\n実は、ずっと言えなかったことがあって。";

/**
 * シーンフェーズ
 * intro         : 入場〜イントロセリフ（雑談 0〜2ターン）
 * asking        : 「聞いてもらえますか？」→ はい ボタン待ち
 * walk          : はい後 → 歩くシーンのセリフ表示
 * proposal1     : プロポーズ前半 → 「・・・」ボタン待ち
 * proposal      : プロポーズ後半 + 承諾/断りボタン
 * accepted_talk : 承諾後の花咲さん反応 → 「手を差し出す」ボタン待ち
 * bracelet      : ブレスレットシーン → ユーザー自由テキスト
 * happy_wait    : 笑顔シーン → エンディング曲 + 20秒待機
 */
type Phase = "intro" | "asking" | "walk" | "proposal1" | "proposal" | "accepted_wait" | "accepted_talk" | "bracelet" | "happy_scene" | "happy_wait";

/**
 * シーン画像インデックス
 * 0: 誰もいない公園 / 1: 登場 / 2: 歩く / 3: プロポーズ真剣 / 4: ブレスレット / 5: 笑顔
 * 6: エンディング1枚目 / 7: エンディング2枚目
 */
const SCENE = { empty: 0, arrival: 1, walk: 2, serious: 3, bracelet: 4, happy: 5, ending1: 6, ending2: 7 } as const;

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
  const [introTurnCount, setIntroTurnCount] = useState(0);
  const [sceneIdx, setSceneIdx] = useState<number>(SCENE.empty);
  const [typing, setTyping] = useState(false);
  const [showEndingButton, setShowEndingButton] = useState(false);
  const [endingSlide, setEndingSlide] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const introOnce = useRef(false);
  const endingMusicRef = useRef<HTMLAudioElement | null>(null);

  const bgmEnabled = useBgmGlobalEnabled();
  const bgmEnabledRef = useRef(bgmEnabled);
  useEffect(() => {
    bgmEnabledRef.current = bgmEnabled;
    // BGM OFF になったらエンディング曲も止める
    if (!bgmEnabled && endingMusicRef.current) {
      endingMusicRef.current.pause();
      endingMusicRef.current = null;
    }
    // BGM ON になったらエンディングフェーズ中なら再開
    if (bgmEnabled && phase === "happy_wait" && !endingMusicRef.current) {
      try {
        const music = new Audio("/audio/ending-theme.mp3");
        music.volume = 0.35;
        endingMusicRef.current = music;
        void music.play();
      } catch { /* ignore */ }
    }
  }, [bgmEnabled, phase]);

  const scenes: string[] = [
    ...(character.proposalDateSceneSrcs?.length
      ? character.proposalDateSceneSrcs
      : character.proposalDateSceneSrc?.trim()
      ? [character.proposalDateSceneSrc.trim()]
      : []),
    ...(character.endingMainImageSrc ? [character.endingMainImageSrc] : []),
    ...(character.endingSubImageSrc ? [character.endingSubImageSrc] : []),
  ];
  const currentSceneSrc = scenes[sceneIdx] ?? scenes[scenes.length - 1] ?? null;

  const isProposalPhase = phase === "proposal1" || phase === "proposal";
  const inputDisabled = (phase !== "intro" && phase !== "bracelet") || typing;

  // happy_wait フェーズ（エンディング曲）では環境BGMを止める
  useProposalMomentAmbient(entranceDone && !leaving && phase !== "happy_wait");

  // スクロール追従
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // 入場アニメ（公園の空き画像のまま表示開始）
  useEffect(() => {
    const id = window.setTimeout(() => {
      setEntranceDone(true);
    }, 600);
    return () => window.clearTimeout(id);
  }, []);

  // entranceDone 後に1回だけ：独り言 → 3秒後に花咲さん登場
  useEffect(() => {
    if (!entranceDone || introOnce.current) return;
    introOnce.current = true;

    // ユーザーの独り言をすぐ表示
    const monologueMsg: Message = {
      id: newMsgId(),
      role: "user",
      content: "ここで待ち合わせ・・ちょっとドキドキする・・・",
      createdAt: Date.now(),
    };
    setMessages([monologueMsg]);

    // 3秒後に花咲さん登場（画像切り替え＋セリフ）
    const t1 = window.setTimeout(() => {
      setSceneIdx(SCENE.arrival);
    }, 3000);

    const t2 = window.setTimeout(() => {
      const introSource =
        character.proposalDateIntroAssistantMessage?.trim() || DEFAULT_PROPOSAL_DATE_INTRO;
      const introText = interpolateUserName(introSource, introTemplateUserName);
      setMessages((prev) => [
        ...prev,
        {
          id: newMsgId(),
          role: "assistant",
          content: introText,
          createdAt: Date.now(),
        },
      ]);
    }, 3600);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [entranceDone, character.proposalDateIntroAssistantMessage, introTemplateUserName]);

  /** はい ボタン → walk シーンへ進む */
  const handleYes = useCallback(() => {
    if (bgmEnabled) {
      try {
        const se = new Audio("/audio/send.mp3");
        se.volume = 0.5;
        void se.play();
      } catch { /* ignore */ }
    }
    const yesMsg: Message = {
      id: newMsgId(),
      role: "user",
      content: "はい",
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, yesMsg]);
    setTyping(true);
    setSceneIdx(SCENE.walk);

    window.setTimeout(() => {
      const walkSource =
        character.proposalDateWalkAssistantMessage?.trim() || DEFAULT_PROPOSAL_DATE_WALK;
      const walkText = interpolateUserName(walkSource, introTemplateUserName);
      setMessages((prev) => [
        ...prev,
        { id: newMsgId(), role: "assistant", content: walkText, createdAt: Date.now() },
      ]);
      setTyping(false);
      setPhase("walk");

        window.setTimeout(() => {
          const proposalSource = character.proposalMessage?.trim() ?? "";
          if (!proposalSource) return;
          const proposalText = interpolateUserName(proposalSource, introTemplateUserName);
          setMessages((prev) => [
            ...prev,
            { id: newMsgId(), role: "assistant", content: proposalText, createdAt: Date.now() },
          ]);
          setPhase("proposal1");
          // 後ろ姿（walk）のまま待機、serious への切り替えは「・・・」ボタン後
        }, WALK_TO_PROPOSAL_MS);
    }, 1600);
  }, [bgmEnabled, character.proposalDateWalkAssistantMessage, character.proposalMessage, introTemplateUserName]);

  // ユーザーがメッセージを送信（intro フェーズのみ・2ターン雑談）
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

      const userMsg: Message = {
        id: newMsgId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setTyping(true);

      const nextTurn = introTurnCount + 1;
      setIntroTurnCount(nextTurn);

      if (nextTurn === 1) {
        // 1ターン目：夜景の雑談
        window.setTimeout(() => {
          const reply = interpolateUserName(DEFAULT_SMALLTALK_1, introTemplateUserName);
          setMessages((prev) => [
            ...prev,
            { id: newMsgId(), role: "assistant", content: reply, createdAt: Date.now() },
          ]);
          setTyping(false);
        }, 1400);
      } else {
        // 2ターン目：「聞いてもらえますか？」→ はい 待ち
        window.setTimeout(() => {
          const reply = interpolateUserName(DEFAULT_SMALLTALK_2, introTemplateUserName);
          setMessages((prev) => [
            ...prev,
            { id: newMsgId(), role: "assistant", content: reply, createdAt: Date.now() },
          ]);
          setTyping(false);
          setPhase("asking");
        }, 1400);
      }
    },
    [
      inputDisabled,
      bgmEnabled,
      introTurnCount,
      introTemplateUserName,
    ]
  );

  /** 「・・・」ボタン → 正面・真剣な表情に切り替えてプロポーズ後半を表示 */
  const handleProposalContinue = useCallback(() => {
    const source2 = character.proposalMessage2?.trim() ?? "";
    if (!source2) return;
    const text2 = interpolateUserName(source2, introTemplateUserName);
    const aid = newMsgId();
    setSceneIdx(SCENE.serious);
    setMessages((prev) => [
      ...prev,
      { id: aid, role: "assistant", content: text2, createdAt: Date.now(), proposalChoices: true },
    ]);
    setProposalMsgId(aid);
    setPhase("proposal");
  }, [character.proposalMessage2, introTemplateUserName]);

  const handleAccept = useCallback(() => {
    if (bgmEnabled) {
      try {
        const se = new Audio("/audio/proposal-accept.mp3");
        se.volume = 0.7;
        void se.play();
      } catch { /* ignore */ }
    }
    // まず waiting フェーズ（ボタン非表示）
    setPhase("accepted_wait" as Phase);

    // セリフ表示後に accepted_talk（ボタン表示）へ
    window.setTimeout(() => {
      const replyText = interpolateUserName(
        `ありがとう…本当に、嬉しいよ。\nそうだ、実は${introTemplateUserName}さんにプレゼントしたいと思ってて…\n手、出して。`,
        introTemplateUserName
      );
      setMessages((prev) => [
        ...prev,
        { id: newMsgId(), role: "assistant", content: replyText, createdAt: Date.now() },
      ]);
      setPhase("accepted_talk");
    }, 1000);
  }, [bgmEnabled, introTemplateUserName]);

  /** 「手を差し出す」ボタン → ブレスレットシーンへ */
  const handleHandOut = useCallback(() => {
    if (bgmEnabledRef.current) {
      try {
        const se = new Audio("/audio/bracelet.mp3");
        se.volume = 0.6;
        void se.play();
      } catch { /* ignore */ }
    }
    setMessages((prev) => [
      ...prev,
      { id: newMsgId(), role: "user", content: "（手を差し出す）", createdAt: Date.now() },
    ]);
    setSceneIdx(SCENE.bracelet);
    setTyping(true);

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: newMsgId(),
          role: "assistant",
          content: "これ、君に似合うと思って。\n今日の記念だよ。",
          createdAt: Date.now(),
        },
      ]);
      setTyping(false);
      setPhase("bracelet");
    }, 1400);
  }, []);

  /** ブレスレットシーンでのユーザー自由テキスト → 全画面エンディングスライドショーへ */
  const handleBraceletReply = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (bgmEnabledRef.current) {
        try {
          const se = new Audio("/audio/send.mp3");
          se.volume = 0.5;
          void se.play();
        } catch { /* ignore */ }
      }

      setMessages((prev) => [
        ...prev,
        { id: newMsgId(), role: "user", content: trimmed, createdAt: Date.now() },
      ]);

      // まず5秒間、夜景バックの笑顔シーンを表示
      setSceneIdx(SCENE.happy);
      setPhase("happy_scene");

      window.setTimeout(() => {
        setEndingSlide(0);
        setPhase("happy_wait");

        // BGM ON の時だけエンディング曲を再生
        if (bgmEnabledRef.current) {
          try {
            const music = new Audio("/audio/ending-theme.mp3");
            music.volume = 0.35;
            endingMusicRef.current = music;
            void music.play();
          } catch { /* ignore */ }
        }

        // 10秒後に2枚目へ
        window.setTimeout(() => setEndingSlide(1), 10000);
        // 20秒後にボタンを表示
        window.setTimeout(() => setShowEndingButton(true), 20000);
      }, 5000);
    },
    [bgmEnabledRef]
  );

  /** エンディングボタン → エンディング曲停止 → フェードアウト → END画面へ */
  const handleEndingProceed = useCallback(() => {
    // エンディング曲を止めてからページ遷移
    if (endingMusicRef.current) {
      endingMusicRef.current.pause();
      endingMusicRef.current = null;
    }
    onBeforeLeave?.();
    setLeaving(true);
    window.setTimeout(() => onAccept(), 400);
  }, [onBeforeLeave, onAccept]);

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

  // happy_wait フェーズ：全画面スライドショー
  const endingImages = [
    character.endingMainImageSrc,
    character.endingSubImageSrc,
  ].filter(Boolean) as string[];
  const currentEndingImg = endingImages[endingSlide] ?? endingImages[0] ?? null;

  const endingInnerThoughts = [
    "これから、二人の思い出、いっぱい作っていこう・・・",
    "二人でいると、本当に癒される・・・ずっと二人で・・・",
  ];
  const currentThought = endingInnerThoughts[endingSlide] ?? "";

  if (phase === "happy_wait") {
    return (
      <div
        className={`fixed inset-0 z-[100] bg-black ${
          leaving ? "pointer-events-none animate-scene-fade-out" : "animate-scene-fade-in"
        }`}
      >
        {currentEndingImg && (
          <Image
            key={currentEndingImg}
            src={currentEndingImg}
            alt="エンディング"
            fill
            sizes="100vw"
            priority
            className="object-contain transition-opacity duration-[1200ms]"
          />
        )}
        {/* 玄一郎の心の声 */}
        {currentThought && (
          <div
            key={currentThought}
            className="absolute inset-x-0 top-0 flex items-start justify-center px-6 pt-10 animate-scene-fade-in"
          >
            <p
              className="text-center text-base leading-loose tracking-[0.15em] text-white"
              style={{
                fontFamily: "var(--font-shippori), 'Hiragino Mincho ProN', serif",
                fontWeight: 400,
                textShadow: "0 1px 6px rgba(0,0,0,0.85), 0 3px 16px rgba(0,0,0,0.6)",
                letterSpacing: "0.18em",
              }}
            >
              {currentThought}
            </p>
          </div>
        )}
        {/* 20秒後に現れるボタン */}
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-12 pt-8"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
            opacity: showEndingButton ? 1 : 0,
            transition: "opacity 1200ms ease-in-out",
            pointerEvents: showEndingButton ? "auto" : "none",
          }}
        >
          <button
            type="button"
            onClick={handleEndingProceed}
            className="rounded-full border-2 border-rose-300/80 bg-black/40 px-8 py-3 text-sm font-semibold text-rose-100 backdrop-blur-sm transition hover:bg-black/60 active:scale-95"
          >
            二人は付き合うことになりました ❤️<br />
            <span className="text-xs font-normal opacity-80">これからも物語は続く・・・</span>
          </button>
        </div>
      </div>
    );
  }

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
        ) : phase === "asking" ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleYes}
              className="rounded-full border-2 border-rose-400/80 bg-rose-50 px-8 py-2.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 active:scale-95"
            >
              はい
            </button>
          </div>
        ) : phase === "proposal1" ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleProposalContinue}
              className="rounded-full border-2 border-slate-400/60 bg-white/80 px-8 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 active:scale-95"
            >
              ・・・
            </button>
          </div>
        ) : phase === "proposal" ? (
          <p className="text-center text-xs text-rose-400/70 italic">
            大切な返事をしてください
          </p>
        ) : phase === "accepted_talk" ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleHandOut}
              disabled={typing}
              className="rounded-full border-2 border-amber-400/80 bg-amber-50 px-8 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 active:scale-95 disabled:opacity-40"
            >
              手を差し出す
            </button>
          </div>
        ) : phase === "bracelet" ? (
          <MessageInput
            onSubmit={handleBraceletReply}
            disabled={inputDisabled}
            placeholder="気持ちを伝える…"
          />
        ) : phase === "happy_scene" || phase === "happy_wait" ? (
          <p className="text-center text-xs text-rose-300/70 italic">
            ✨
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
