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
import { useBarPolarisAmbient } from "@/hooks/useBarPolarisAmbient";
import type { AffinityPulse, Character, ChatResponseBody, Message } from "@/types";

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
  affinityPulse?: AffinityPulse | null;
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
  /** `setLeaving(true)` と同タイミングで呼ばれる（親側の暗転用） */
  onBeforeLeave?: () => void;
};

export function BarVenuePanel({
  character,
  affinity,
  affinityPulse,
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
  onBeforeLeave,
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
  const arrivalSrc = character.barDateArrivalSrc?.trim();
  /**
   * overlayBgSrc: 最初に手前に表示するオーバーレイ画像。
   * - arrivalSrc があれば到着画像（1ターン後にフェードアウト）
   * - なければ emptySrc（タイマーでフェードアウト・既存挙動）
   */
  const overlayBgSrc = arrivalSrc || emptySrc;
  const hasPairBg = Boolean(overlayBgSrc && withSrc);
  void Boolean(withSrc && !overlayBgSrc); // hasSoloBarBg: 新レイアウトでは画像コンテナ条件に統合済み
  const telopLine =
    character.barDateLocationTelop?.trim() || DEFAULT_BAR_LOCATION_TELOP;

  const silenceHeroSrc = character.barDateSilenceHeroSrc?.trim();
  const silenceHeroMin = character.barDateSilenceHeroTurnMin ?? 4;
  const silenceHeroMax = character.barDateSilenceHeroTurnMax ?? 5;
  const silenceInnerOnTurn = character.barDateSilenceInnerOnTurnSubmit ?? 4;
  const silenceInnerLine = character.barDateSilenceInnerLine?.trim();

  const [entranceDone, setEntranceDone] = useState(false);
  const [whiteVeilGone, setWhiteVeilGone] = useState(false);
  const [telopVisible, setTelopVisible] = useState(false);
  /** タイマー駆動（emptySrc のみ）のペアフェード用フラグ */
  const [timerPairLayerVisible, setTimerPairLayerVisible] = useState(!hasPairBg);
  /**
   * arrivalSrc がある場合は 1 ターン後に overlay を消す（ターン駆動）。
   * ない場合は既存タイマー駆動。
   * pairLayerVisible = true → overlay opacity 0（乾杯画像が見える）
   */
  const pairLayerVisible = arrivalSrc
    ? turnsInScene >= 1
    : timerPairLayerVisible;

  const userSays = messages.filter((m) => m.role === "user").length;
  const showLeavePrompt =
    entranceDone &&
    turnsInScene >= minTurns &&
    turnsInScene < maxTurns &&
    !leaving;
  const inputBlocked =
    !entranceDone || sending || leaving || turnsInScene >= maxTurns;

  /** ５ターン目前後の「一息」：東京タワー横顔ヒーローを重ねる */
  const showSilenceHero =
    Boolean(silenceHeroSrc) &&
    entranceDone &&
    !leaving &&
    turnsInScene >= silenceHeroMin &&
    turnsInScene <= silenceHeroMax;

  void hidePortraitStrip; // 新レイアウトでは画像カード内に統合済み

  useBarPolarisAmbient(entranceDone && !leaving);
  const bgmEnabled = useBgmGlobalEnabled();

  /** 乾杯画像が現れた瞬間（overlay フェードアウト開始）に効果音を鳴らす */
  const prevPairLayerVisible = useRef(false);
  useEffect(() => {
    if (pairLayerVisible && !prevPairLayerVisible.current && bgmEnabled) {
      try {
        const se = new Audio("/audio/kanpai.mp3");
        se.volume = 0.6;
        void se.play();
      } catch { /* ignore */ }
    }
    prevPairLayerVisible.current = pairLayerVisible;
  }, [pairLayerVisible, bgmEnabled]);

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

    if (hasPairBg && !arrivalSrc) {
      // タイマー駆動フェード（emptySrc のみの場合）
      after(sceneRevealedAt + SOLO_HOLD_MS, () => setTimerPairLayerVisible(true));
      after(
        sceneRevealedAt + SOLO_HOLD_MS + PAIR_CROSS_MS + POST_AMBIENT_MS,
        () => setEntranceDone(true)
      );
    } else {
      // arrivalSrc がある場合はターン駆動なのでタイマー不要
      after(sceneRevealedAt + POST_AMBIENT_MS, () => setEntranceDone(true));
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPairBg, arrivalSrc]);

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
    onBeforeLeave?.();
    setLeaving(true);
    setError(null);
    window.setTimeout(() => {
      onFinishedBarDate();
    }, 400);
  }, [leaving, onBeforeLeave, onFinishedBarDate]);

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
    onBeforeLeave?.();
    setLeaving(true);
    setError(null);
    window.setTimeout(() => {
      onInterruptBarDate();
    }, 400);
  }, [leaving, entranceDone, userSays, onBeforeLeave, onInterruptBarDate]);

  const submitBar = useCallback(
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

        const useSilenceInner =
          Boolean(silenceInnerLine) && turnsInScene === silenceInnerOnTurn;

        const wait = assistantTypingDelayMs(character, affinity);
        if (wait > 0) {
          await sleepMs(wait);
        }

        const assistantMsg: Message = {
          id: newMsgId(),
          role: "assistant",
          content: data.reply,
          inner: useSilenceInner ? silenceInnerLine : data.inner || undefined,
          affinityChange: data.affinityChange ?? 0,
          createdAt: Date.now(),
          autoKind: useSilenceInner ? "bar_silence_inner" : undefined,
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
      bgmEnabled,
      character,
      inputBlocked,
      maxTurns,
      messages,
      onAffinityDelta,
      onVenueTurnCompleted,
      turnsInScene,
      silenceInnerLine,
      silenceInnerOnTurn,
      userName,
    ]
  );

  const whiteFadeOutMs = whiteVeilGone ? WHITE_OUT_MS : 0;

  /** 表示する1枚絵（沈黙演出中は横顔に差し替え） */
  const heroImageSrc = showSilenceHero && silenceHeroSrc ? silenceHeroSrc : (withSrc ?? emptySrc ?? null);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col bg-slate-950 ${
        leaving
          ? "pointer-events-none animate-scene-fade-out"
          : "animate-scene-fade-in"
      }`}
      role="dialog"
      aria-label="バー・飲みデートシーン"
      aria-busy={!entranceDone}
    >
      {/* 背景グラデーション */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(251,113,133,0.10),_transparent_55%)]" />

      {/* 白ヴェール（入場演出） */}
      <div
        className="pointer-events-none absolute inset-0 z-[140] bg-white transition-opacity ease-out"
        style={{ opacity: whiteVeilGone ? 0 : 1, transitionDuration: `${whiteFadeOutMs}ms` }}
      />
      {/* テロップ */}
      <div
        className={`pointer-events-none absolute inset-0 z-[160] flex items-center justify-center px-8 transition-opacity duration-500 ease-out ${
          telopVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-center text-sm font-semibold italic tracking-[0.18em] text-slate-600 drop-shadow-sm">
          {telopLine}
        </p>
      </div>

      {/* ヘッダー：3カラム（名前 / ハート / BGM+中断） */}
      <header
        className={`relative z-10 grid min-h-[3.25rem] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 border-b border-white/15 bg-black/50 px-3 py-2 text-white backdrop-blur-md shadow-sm transition-opacity duration-700 sm:px-4 ${
          entranceDone ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* 左：キャラ名 */}
        <div className="flex min-w-0 items-center gap-2">
          {portraitSrc ? (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-rose-300/30">
              <Image src={portraitSrc} alt={character.name} fill sizes="32px" className="object-cover object-top" />
            </div>
          ) : null}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{character.name}</p>
            <p className="truncate text-[10px] text-rose-200/70">🍷 Bar Polaris 個室</p>
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
            onClick={() => interrupt()}
            disabled={leaving || !entranceDone}
            className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-medium text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-40 sm:px-3 sm:text-[11px]"
          >
            退室
          </button>
        </div>
      </header>

      {/* メインコンテンツ：画像 ＋ 会話 */}
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* バーの1枚絵（中央に配置） */}
        {heroImageSrc ? (
          <div className={`shrink-0 px-3 pb-1.5 pt-2 transition-opacity duration-700 sm:px-4 sm:pb-2 sm:pt-3 ${entranceDone ? "opacity-100" : "opacity-40"}`}>
            <div
              className="relative isolate mx-auto h-[min(26vh,200px)] overflow-hidden rounded-2xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.7)] ring-1 ring-rose-200/20 sm:h-[min(36vh,320px)]"
              style={{ maxWidth: "min(92vw, 420px)" }}
            >
              {/* ベース画像（乾杯・bar_with_him） */}
              {withSrc ? (
                <Image
                  src={withSrc}
                  alt="バー個室"
                  fill
                  sizes="(max-width: 768px) 92vw, 420px"
                  priority
                  className="object-cover object-center"
                />
              ) : null}
              {/* オーバーレイ（到着 or 無人）：pairLayerVisible=true でフェードアウト */}
              {hasPairBg && overlayBgSrc ? (
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: pairLayerVisible ? 0 : 1,
                    transitionProperty: "opacity",
                    transitionDuration: `${PAIR_CROSS_MS}ms`,
                    transitionTimingFunction: "ease-out",
                  }}
                >
                  <Image
                    src={overlayBgSrc}
                    alt="到着シーン"
                    fill
                    sizes="(max-width: 768px) 92vw, 420px"
                    priority
                    className="object-cover object-center"
                  />
                </div>
              ) : null}
              {/* 沈黙演出：横顔をオーバーレイ */}
              {silenceHeroSrc ? (
                <div
                  className="absolute inset-0 transition-opacity duration-[1100ms] ease-out"
                  style={{ opacity: showSilenceHero ? 1 : 0 }}
                >
                  <Image
                    src={silenceHeroSrc}
                    alt="沈黙"
                    fill
                    sizes="(max-width: 768px) 92vw, 420px"
                    className="object-cover object-[center_30%]"
                  />
                </div>
              ) : null}
              {/* 画像の下部をグラデーションで自然につなぐ */}
              <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-slate-950/60 to-transparent" />
            </div>
          </div>
        ) : null}

        {/* スクロール可能な会話エリア */}
        <div
          ref={scrollRef}
          className={`scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 transition-opacity duration-700 ${
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
          {sending ? (
            <p className="px-2 text-xs text-white/80 drop-shadow">
              {character.displayName}が考えています…
            </p>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-red-300/70 bg-red-950/70 px-3 py-2 text-xs text-red-50">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      {/* フッター：入力エリア */}
      <footer
        className={`relative z-10 mt-auto shrink-0 flex-col gap-2 border-t border-white/15 bg-black/50 px-3 py-3 backdrop-blur-md transition-opacity duration-700 ${
          entranceDone ? "opacity-100 flex" : "opacity-0 hidden"
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
          <p className="text-center text-[11px] text-rose-200/80">
            あと <span className="font-semibold text-rose-100">{minTurns - turnsInScene}</span> ターンで「帰る」が選べます
          </p>
        ) : null}

        {turnsInScene >= maxTurns && !leaving && entranceDone ? (
          <p className="text-center text-[11px] text-rose-200/80">
            今夜はゆっくり話せてよかった。また連絡するね…（自動で退席）
          </p>
        ) : null}

        {showSilenceHero && silenceInnerLine && !sending && !leaving
          ? turnsInScene <= silenceHeroMin ? (
              <p className="rounded-xl bg-black/35 px-3 py-2 text-center text-[10px] font-medium leading-relaxed text-rose-50/90 drop-shadow md:text-[11px]">
                会話がゆっくりと沈んでいく、心地よい一拍。窓の外は東京タワー、視線だけが横へ…。
              </p>
            ) : turnsInScene === silenceHeroMin + 1 &&
              messages.some((m) => m.role === "assistant" && m.autoKind === "bar_silence_inner") ? (
              <p className="rounded-xl bg-black/35 px-3 py-2 text-center text-[10px] font-medium leading-relaxed text-rose-50/90 drop-shadow md:text-[11px]">
                「💭内心を見る」で、彼がどう感じていたか……覗けるかもしれない。
              </p>
            ) : null
          : null}

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
