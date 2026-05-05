"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { DateInviteButtons } from "@/components/DateInviteButtons";
import { AffinityDemoToolbar, type DemoScene } from "@/components/AffinityDemoToolbar";
import {
  BgmToggleButton,
  useBgmGlobalEnabled,
} from "@/components/BgmPreferenceProvider";
import { HeartIndicator } from "@/components/HeartIndicator";
import { MessageInput } from "@/components/MessageInput";
import { StampPicker } from "@/components/StampPicker";
import { UnlockToast } from "@/components/UnlockToast";
import { usePlayerProfileState } from "@/components/PlayerNameProvider";
import { BarVenuePanel } from "@/components/BarVenuePanel";
import { OvernightStayPanel } from "@/components/OvernightStayPanel";
import { TeaDateCafePanel } from "@/components/TeaDateCafePanel";
import { ProposalDatePanel } from "@/components/ProposalDatePanel";
import {
  getCharacter,
  pickCharacterPortrait,
} from "@/characters";
import { clearCachedAnalysis } from "@/lib/analysisCache";
import {
  showChatAffinityDemoTools,
  showChatResetButton,
} from "@/lib/chatDevTools";
import {
  clearIntimateSecretShown,
  loadIntimateSecretShown,
  saveIntimateSecretShown,
} from "@/lib/intimateSecretStorage";
import { assistantTypingDelayMs, sleepMs } from "@/lib/replyLatency";
import {
  canTriggerProposal,
  evaluateUnlocks,
  incrementDateCount,
  initialDateProgress,
  loadDateProgress,
  saveDateProgress,
} from "@/lib/dateProgress";
import {
  messageContentForGemini,
  getStamp as getStampFromCatalog,
  stamps as stampDefinitions,
} from "@/lib/stamps";
import { useAffinity } from "@/hooks/useAffinity";
import { useCompanionSilencePing } from "@/hooks/useCompanionSilencePing";
import { useLineChatAmbient } from "@/hooks/useLineChatAmbient";
import { useProposalMomentAmbient } from "@/hooks/useProposalAmbient";
import { COMPANION_IDLE_SILENCE_MS } from "@/lib/companionIdle";
import { interpolateUserName } from "@/lib/promptInterpolate";
import type {
  AffinityPulse,
  ChatMode,
  ChatResponseBody,
  DateInviteType,
  DateProgress,
  Message,
  ProposalState,
  SceneEvent,
  SceneState,
} from "@/types";
import {
  lineSceneState,
  overnightSceneState,
  proposalSceneState,
  venueSceneState,
} from "@/types";

export interface ChatExperienceProps {
  charId: string;
  /** 現状は `line` のみ。scene / call はレイアウト・フックのみ先行 */
  mode?: ChatMode;
  /** scene モード時のイベント差し込み用（データ属性のみ。処理は将来） */
  sceneEvent?: SceneEvent | null;
}

const MESSAGES_PREFIX = "messages_";

/** 誤配布などで localStorage に残った開幕挨拶。復元時は最新の greeting に差し替える */
const OBSOLETE_LINE_OPENING_ASSISTANT_TEXT = new Set([
  "こんばんは。今日は冷えますね。",
]);
const PROPOSAL_PREFIX = "proposal_";
const AWAITING_PREFIX = "awaiting_outing_";
const POST_ENDING_PREFIX = "post_ending_";

const DEFAULT_TEA_INVITE_USER_MESSAGE =
  "今度、お茶でも飲みに行きませんか？";
const DEFAULT_DRINK_INVITE_USER_MESSAGE =
  "今度、お酒でも飲みに行きませんか？";

/** お茶デート後 LINE 復帰の締め（`teaDateClosingAssistantMessage` 未設定時） */
const DEFAULT_TEA_DATE_FAREWELL_LINE =
  "今日はお時間いただいて、ありがとうございました。\nまた、お話できたら嬉しいです。";

/** バーデート後 LINE 復帰の締め（`barDateClosingAssistantMessage` 未設定時） */
const DEFAULT_BAR_DATE_FAREWELL_LINE =
  "今夜は、本当にありがとうございました。\n" +
  "…また、こうして話せたら嬉しいです。\n" +
  "気をつけて帰ってくださいね。";

/** バー退店〜LINE復帰で加算する好感度（`CharacterConfig.barDateAffinityBonusOnLeave` が無いとき） */
const DEFAULT_BAR_LEAVE_AFFINITY_BONUS = 12;

const LINE_IDLE_POKE_LINES = [
  "どうしたの？ 無理してない？",
  "ふと、君のこと考えてた。",
  "手が空いたら、少しだけ話そう。",
];

function clampAffinity(n: number, max = 100): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

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

  const { profile: userProfile } = usePlayerProfileState();
  const chatUserName = useMemo(() => {
    const raw = userProfile?.name ?? "";
    return raw.trim() || "あなた";
  }, [userProfile?.name]);
  const router = useRouter();
  const {
    affinity,
    setAffinity,
    hydrated: affinityHydrated,
  } = useAffinity(character.id, character.initialAffinity);

  /** エンディング後の続きプレイモード（好感度上限200） */
  const [postEnding, setPostEnding] = useState(false);
  const affinityMax = postEnding ? 200 : 100;
  /** 無言トリガ／ユーザー送信ごとに増やして沈黙タイマーをリセット */
  const [companionActivityEpoch, setCompanionActivityEpoch] = useState(0);

  /** シーン遷移時の暗転オーバーレイ制御 */
  const [sceneDim, setSceneDim] = useState(false);
  /** エンディングページへの遷移前フェードアウト */
  const [fadingToEnding, setFadingToEnding] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [historyHydrated, setHistoryHydrated] = useState(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [dateProgress, setDateProgress] =
    useState<DateProgress>(initialDateProgress);
  const [affinityPulse, setAffinityPulse] = useState<AffinityPulse | null>(
    null
  );
  const [unlockToast, setUnlockToast] = useState<string | null>(null);
  const [pendingInviteAcceptance, setPendingInviteAcceptance] =
    useState<DateInviteType | null>(null);

  const bgmEnabled = useBgmGlobalEnabled();

  /** 好感度上昇時に効果音を鳴らす */
  useEffect(() => {
    if (!affinityPulse || affinityPulse.delta <= 0 || !bgmEnabled) return;
    try {
      const se = new Audio("/audio/affinity-up.mp3");
      se.volume = 0.5;
      void se.play();
    } catch { /* ignore */ }
  }, [affinityPulse, bgmEnabled]);

  /** 好感度下降時に効果音を鳴らす */
  useEffect(() => {
    if (!affinityPulse || affinityPulse.delta >= 0 || !bgmEnabled) return;
    try {
      const se = new Audio("/audio/affinity-down.mp3");
      se.volume = 0.5;
      void se.play();
    } catch { /* ignore */ }
  }, [affinityPulse, bgmEnabled]);

  /** デート解禁時に成功音を鳴らす */
  useEffect(() => {
    if (!unlockToast || !bgmEnabled) return;
    try {
      const se = new Audio("/audio/unlock.mp3");
      se.volume = 0.55;
      void se.play();
    } catch {
      // ignore
    }
  }, [unlockToast, bgmEnabled]);

  /** リセット後に進行途中の `/api/chat` 応答で state が上書きされないようにする */
  const conversationEpochRef = useRef(0);

  /** デート復帰時の evaluateUnlocks などで参照する現在好感度 */
  const affinityRef = useRef(affinity);
  useEffect(() => {
    affinityRef.current = affinity;
  }, [affinity]);

  const intimacyBootstrapRef = useRef(false);
  const intimacyPrevAffinityRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    intimacyBootstrapRef.current = false;
    intimacyPrevAffinityRef.current = null;
  }, [character.id]);

  /** お茶承諾後の「☕ 一緒にお茶しに行く」待ち状態（localStorage で永続化） */
  const [awaitingTeaOuting, setAwaitingTeaOutingRaw] = useState(false);
  /** 飲み承諾後のバー入室待ち（localStorage で永続化） */
  const [awaitingDrinkOuting, setAwaitingDrinkOutingRaw] = useState(false);
  /** プロポーズデート招待後の「💍 デートに行く」待ち状態（localStorage で永続化） */
  const [awaitingProposalDate, setAwaitingProposalDateRaw] = useState(false);

  const setAwaitingTeaOuting = useCallback((val: boolean) => {
    setAwaitingTeaOutingRaw(val);
    try {
      if (val) {
        window.localStorage.setItem(`${AWAITING_PREFIX}${character.id}`, "tea");
      } else {
        const cur = window.localStorage.getItem(`${AWAITING_PREFIX}${character.id}`);
        if (cur === "tea") window.localStorage.removeItem(`${AWAITING_PREFIX}${character.id}`);
      }
    } catch { /* ignore */ }
  }, [character.id]);

  const setAwaitingDrinkOuting = useCallback((val: boolean) => {
    setAwaitingDrinkOutingRaw(val);
    try {
      if (val) {
        window.localStorage.setItem(`${AWAITING_PREFIX}${character.id}`, "drink");
      } else {
        const cur = window.localStorage.getItem(`${AWAITING_PREFIX}${character.id}`);
        if (cur === "drink") window.localStorage.removeItem(`${AWAITING_PREFIX}${character.id}`);
      }
    } catch { /* ignore */ }
  }, [character.id]);

  const setAwaitingProposalDate = useCallback((val: boolean) => {
    setAwaitingProposalDateRaw(val);
    try {
      if (val) {
        window.localStorage.setItem(`${AWAITING_PREFIX}${character.id}`, "proposal");
      } else {
        const cur = window.localStorage.getItem(`${AWAITING_PREFIX}${character.id}`);
        if (cur === "proposal") window.localStorage.removeItem(`${AWAITING_PREFIX}${character.id}`);
      }
    } catch { /* ignore */ }
  }, [character.id]);

  /** LINE / 店シーンの進行（バーは将来 `mode: "bar"` で拡張） */
  const [sceneState, setSceneState] = useState<SceneState>(() =>
    lineSceneState()
  );
  const [teaDateSessionKey, setTeaDateSessionKey] = useState(0);

  /** シーン遷移タイトルカード */
  const [sceneTitleCard, setSceneTitleCard] = useState<{
    emoji: string;
    name: string;
    sub?: string;
  } | null>(null);
  const [sceneTitleVisible, setSceneTitleVisible] = useState(false);

  const venueUiOpen =
    sceneState.mode === "cafe" ||
    sceneState.mode === "bar" ||
    sceneState.mode === "overnight" ||
    sceneState.mode === "proposal";

  /** `npm run dev` または `NEXT_PUBLIC_DEV_TOOLS=1`（ハッカソン即席デモ） */
  const showAffinityDemoTools = showChatAffinityDemoTools();
  const showResetButton = showChatResetButton();

  const proposalThreshold = character.proposalThreshold;
  const proposalText = useMemo(() => {
    const userName = userProfile?.name ?? "";
    return interpolateUserName(character.proposalMessage ?? "", userName);
  }, [character.proposalMessage, userProfile?.name]);

  const greetingText = useMemo(
    () =>
      interpolateUserName(
        character.greeting ?? "こんばんは。",
        userProfile?.name ?? ""
      ),
    [character.greeting, userProfile?.name]
  );

  /** 「もう少し考える」後は true を維持（通常返答後に false に戻して再プロポーズ可能に） */
  const [proposalDelivered, setProposalDelivered] = useState(false);
  const [proposalLSBootstrapped, setProposalLSBootstrapped] = useState(false);
  const [proposalChoiceMsgId, setProposalChoiceMsgId] = useState<string | null>(
    null
  );

  /** proposal_${charId} の復元 */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(
        `${PROPOSAL_PREFIX}${character.id}`
      );
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ProposalState>;
        setProposalDelivered(Boolean(parsed.delivered));
      }
    } catch {
      // ignore
    }
    setProposalLSBootstrapped(true);
  }, [character.id]);

  /** ProposalState を永続（isReady は好感度から都度算出） */
  useEffect(() => {
    if (typeof window === "undefined" || !proposalLSBootstrapped) return;
    const t = proposalThreshold;
    const payload: ProposalState = {
      isReady: typeof t === "number" ? affinity >= t : false,
      delivered: proposalDelivered,
    };
    try {
      window.localStorage.setItem(
        `${PROPOSAL_PREFIX}${character.id}`,
        JSON.stringify(payload)
      );
    } catch {
      // ignore
    }
  }, [
    affinity,
    proposalDelivered,
    proposalThreshold,
    proposalLSBootstrapped,
    character.id,
  ]);

  /** localStorage はレンダーの save より先に反映（useEffect だけだと初回ゼロ上書きの恐れがある） */
  useLayoutEffect(() => {
    setDateProgress(loadDateProgress(character.id));
  }, [character.id]);

  // useEffect で一本化（dateProgress が変わるたびに永続化）
  useEffect(() => {
    saveDateProgress(character.id, dateProgress);
  }, [character.id, dateProgress]);

  /** 閾値未満に落ちたら delivered を初期化（好感度復元前のチラ見えでの誤リセットは抑制） */
  useEffect(() => {
    const t = proposalThreshold;
    if (
      typeof t !== "number" ||
      !proposalLSBootstrapped ||
      !affinityHydrated
    )
      return;
    if (affinity < t) setProposalDelivered(false);
  }, [
    affinity,
    proposalThreshold,
    proposalLSBootstrapped,
    affinityHydrated,
  ]);

  const proposalPending = proposalChoiceMsgId !== null || awaitingProposalDate;

  const lineAmbientActive = sceneState.mode === "line" && !proposalPending;

  useLineChatAmbient(lineAmbientActive);
  useProposalMomentAmbient(proposalPending);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(
        `${MESSAGES_PREFIX}${character.id}`
      );
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          const opener = interpolateUserName(
            character.greeting ?? "こんばんは。",
            userProfile?.name ?? ""
          );
          if (
            first.role === "assistant" &&
            typeof first.content === "string" &&
            OBSOLETE_LINE_OPENING_ASSISTANT_TEXT.has(first.content)
          ) {
            parsed[0] = { ...first, content: opener };
          }
          setMessages(parsed);
          const pending = parsed.find((m) => m.proposalChoices);
          setProposalChoiceMsgId(pending?.id ?? null);
        } else if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore
    }
    setHistoryHydrated(true);

    // お茶・飲み・プロポーズの「承諾後ボタン」状態を復元
    try {
      const outing = window.localStorage.getItem(`${AWAITING_PREFIX}${character.id}`);
      if (outing === "tea") setAwaitingTeaOutingRaw(true);
      else if (outing === "drink") setAwaitingDrinkOutingRaw(true);
      else if (outing === "proposal") setAwaitingProposalDateRaw(true);
    } catch { /* ignore */ }

    // エンディング後の続きプレイモードを復元
    try {
      const pe = window.localStorage.getItem(`${POST_ENDING_PREFIX}${character.id}`);
      if (pe === "true") {
        setPostEnding(true);
        // クリア後はお茶・お酒を常時解放
        setDateProgress((prev) => ({
          ...prev,
          unlockedTea: true,
          unlockedDrink: true,
        }));
      }
    } catch { /* ignore */ }
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
        content: greetingText,
        createdAt: Date.now(),
      },
    ]);
  }, [historyHydrated, messages.length, greetingText]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  /** 好感度が閾値を超えた最初のタイミング（または復元済みの高好感度セーブ時）での一度きり独白 */
  useEffect(() => {
    if (!affinityHydrated || !historyHydrated) return;
    if (typeof window === "undefined") return;

    const payload = character.intimacySecretAssistantMessage?.trim();
    if (!payload) return;

    const threshold =
      typeof character.intimacySecretAffinityThreshold === "number"
        ? character.intimacySecretAffinityThreshold
        : typeof character.proposalThreshold === "number"
          ? character.proposalThreshold
          : 95;

    const tryAppend = (
      crossed: boolean,
      alreadyHighBootstrap: boolean
    ) => {
      if (!crossed && !alreadyHighBootstrap) return;
      const txt = interpolateUserName(payload, userProfile?.name ?? "");
      const secretMsg: Message = {
        id: newId(),
        role: "assistant",
        content: txt,
        createdAt: Date.now(),
        autoKind: "intimacy_secret",
      };
      setMessages((msgs) => {
        if (msgs.some((m) => m.autoKind === "intimacy_secret")) return msgs;
        if (loadIntimateSecretShown(character.id)) return msgs;
        saveIntimateSecretShown(character.id);
        return [...msgs, secretMsg];
      });
    };

    if (!intimacyBootstrapRef.current) {
      intimacyBootstrapRef.current = true;
      intimacyPrevAffinityRef.current = affinity;
      const alreadyHighBootstrap = affinity >= threshold;
      queueMicrotask(() => tryAppend(false, alreadyHighBootstrap));
      return;
    }

    const prev = intimacyPrevAffinityRef.current ?? affinity;
    intimacyPrevAffinityRef.current = affinity;
    if (prev < threshold && affinity >= threshold) {
      queueMicrotask(() => tryAppend(true, false));
    }
  }, [
    affinity,
    affinityHydrated,
    historyHydrated,
    character.id,
    character.intimacySecretAffinityThreshold,
    character.intimacySecretAssistantMessage,
    character.proposalThreshold,
    userProfile?.name,
  ]);

  const sendUserRound = useCallback(
    async (
      userMsg: Message,
      opts?: {
        inviteAcceptance?: DateInviteType;
      }
    ) => {
      setError(null);

      const t = proposalThreshold;
      const proposeText = proposalText.trim() ? proposalText : undefined;
      const inviteAcceptance = opts?.inviteAcceptance;

      const proposeGate =
        typeof t === "number" &&
        Boolean(proposeText) &&
        !proposalDelivered &&
        !awaitingProposalDate &&
        !postEnding && // 続きプレイ時はプロポーズを再発動しない
        !messages.some((m) => m.proposalChoices) &&
        canTriggerProposal(affinity, dateProgress, character);

      if (proposeGate && userMsg.role === "user") {
        setSending(true);
        setMessages((prev) => [...prev, userMsg]);
        // 招待メッセージを LINE 上に挿入し、「デートに行く」ボタン待ちへ
        const inviteSource =
          character.proposalDateInviteAssistantMessage?.trim() ||
          "少し、話したいことがあって。よかったら、今度二人でどこかで会えませんか。";
        const inviteText = interpolateUserName(
          inviteSource,
          userProfile?.name ?? ""
        );
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: inviteText,
            createdAt: Date.now(),
          },
        ]);
        setProposalDelivered(true);
        setAwaitingProposalDate(true);
        setSending(false);
        return;
      }

      setSending(true);

      const historyForApi = messages.map((m) => ({
        role: m.role,
        content: messageContentForGemini(m),
      }));

      setMessages((prev) => [...prev, userMsg]);

      const epochSnapshot = conversationEpochRef.current;

      try {
        const teaDateCafe = sceneState.mode === "cafe";
        const teaDateBar = sceneState.mode === "bar";
        const body = {
          messages: historyForApi,
          affinity,
          userName: userProfile?.name ?? "",
          teaDateCafe,
          teaDateBar,
          turnsInScene: sceneState.turnsInScene,
          maxTurns: sceneState.maxTurns,
          ...(inviteAcceptance ? { inviteType: inviteAcceptance } : {}),
          charId: character.id,
          userMessage: messageContentForGemini(userMsg),
          postEndingCouplePlay: postEnding,
        };

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (conversationEpochRef.current !== epochSnapshot) {
          return;
        }

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (conversationEpochRef.current !== epochSnapshot) {
            return;
          }
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as ChatResponseBody;

        if (conversationEpochRef.current !== epochSnapshot) {
          return;
        }

        const delayMs =
          sceneState.mode === "line"
            ? assistantTypingDelayMs(character, affinity)
            : 0;
        if (delayMs > 0) {
          await sleepMs(delayMs);
        }
        if (conversationEpochRef.current !== epochSnapshot) {
          return;
        }

        const delta =
          typeof data.affinityChange === "number" ? data.affinityChange : 0;
        const change = delta;

        const newAffinity = clampAffinity(affinity + change, affinityMax);
        const prevProgress = dateProgress;

        const updated = evaluateUnlocks(newAffinity, prevProgress, character);

        const assistantMsg: Message = {
          id: newId(),
          role: "assistant",
          content: data.reply,
          inner: data.inner || undefined,
          affinityChange: data.affinityChange ?? 0,
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        setAffinity(newAffinity);
        setAffinityPulse({ delta: change, timestamp: Date.now() });
        setDateProgress(updated);

        if (!prevProgress.unlockedDrink && updated.unlockedDrink) {
          setUnlockToast("🍶 「飲みに誘う」が解放されました");
        } else if (!prevProgress.unlockedTea && updated.unlockedTea) {
          setUnlockToast("🍵 「お茶に誘う」が解放されました");
        }

        if (inviteAcceptance === "tea") {
          setAwaitingTeaOuting(true);
        }
        if (inviteAcceptance === "drink") {
          setAwaitingDrinkOuting(true);
        }

        const affinityAfterGemini = newAffinity;

        if (
          typeof t === "number" &&
          affinityAfterGemini >= t &&
          proposalDelivered
        ) {
          setProposalDelivered(false);
        }

        setCompanionActivityEpoch((x) => x + 1);
      } catch (err) {
        if (conversationEpochRef.current !== epochSnapshot) {
          return;
        }
        console.error(err);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setError(
          err instanceof Error
            ? err.message
            : "通信に失敗しました。もう一度お試しください。"
        );
      } finally {
        setSending(false);
      }
    },
    // useAffinity の setAffinity は setter と同様に参照が安定しているため省略する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      affinity,
      character,
      dateProgress,
      messages,
      awaitingProposalDate,
      proposalDelivered,
      proposalText,
      proposalThreshold,
      setAwaitingProposalDate,
      chatUserName,
      sceneState.maxTurns,
      sceneState.mode,
      sceneState.turnsInScene,
      userProfile?.name,
      postEnding,
    ]
  );

  const sendMessage = useCallback(
    async (
      text: string,
      opts?: {
        inviteAcceptance?: DateInviteType;
      }
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (bgmEnabled) {
        try {
          const se = new Audio("/audio/send.mp3");
          se.volume = 0.5;
          void se.play();
        } catch { /* ignore */ }
      }

      const userMsg: Message = {
        id: newId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      await sendUserRound(userMsg, opts);
    },
    [bgmEnabled, sendUserRound]
  );

  const handleStampPick = useCallback(
    async (stampId: string) => {
      const def = getStampFromCatalog(stampId);
      if (!def) return;

      if (bgmEnabled) {
        try {
          const se = new Audio("/audio/stamp.mp3");
          se.volume = 0.55;
          void se.play();
        } catch { /* ignore */ }
      }

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
    [sendUserRound, bgmEnabled]
  );

  const runCompanionIdlePokeLine = useCallback(async (): Promise<boolean> => {
    if (!postEnding) return false;
    const msgs = messagesRef.current;
    if (!msgs.length || msgs[msgs.length - 1].role !== "assistant") {
      return false;
    }
    setSending(true);
    try {
      const delayMs = assistantTypingDelayMs(character, affinityRef.current);
      if (delayMs > 0) {
        await sleepMs(delayMs);
      }
      const line =
        LINE_IDLE_POKE_LINES[
          Math.floor(Math.random() * LINE_IDLE_POKE_LINES.length)
        ] ?? LINE_IDLE_POKE_LINES[0];

      const assistantMsg: Message = {
        id: newId(),
        role: "assistant",
        content: line,
        inner: "黙ってる時間も心地いいな。",
        affinityChange: 0,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setCompanionActivityEpoch((e) => e + 1);
      return true;
    } catch (e) {
      console.error(e);
      setCompanionActivityEpoch((e) => e + 1);
      return false;
    } finally {
      setSending(false);
    }
  }, [
    postEnding,
    character,
    setMessages,
    setSending,
  ]);

  const companionSilenceLineMayNudge =
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant";

  useCompanionSilencePing({
    enabled:
      Boolean(postEnding) && historyHydrated && affinityHydrated,
    paused:
      sending ||
      proposalPending ||
      venueUiOpen ||
      sceneState.mode !== "line" ||
      !historyHydrated ||
      !affinityHydrated,
    silenceMs: COMPANION_IDLE_SILENCE_MS,
    companionMayNudge: companionSilenceLineMayNudge,
    activityEpoch: companionActivityEpoch,
    onPing: runCompanionIdlePokeLine,
  });

  const handleReset = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `会話履歴をリセットし、好感度をキャラ初期値（${character.initialAffinity}）に戻してやり直します。よろしいですか？`
      )
    ) {
      return;
    }

    conversationEpochRef.current += 1;
    setSending(false);
    setError(null);

    setAffinity(clampAffinity(character.initialAffinity));
    setMessages([]);
    setDateProgress(initialDateProgress);
    setProposalDelivered(false);
    setProposalChoiceMsgId(null);

    setAffinityPulse(null);
    setUnlockToast(null);
    setPendingInviteAcceptance(null);
    setAwaitingTeaOuting(false);
    setAwaitingDrinkOuting(false);
    setAwaitingProposalDate(false);
    setSceneState(lineSceneState());

    setPostEnding(false);
    setCompanionActivityEpoch(0);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`${PROPOSAL_PREFIX}${character.id}`);
      window.localStorage.removeItem(`date_progress_${character.id}`);
      window.localStorage.removeItem(`${MESSAGES_PREFIX}${character.id}`);
      window.localStorage.removeItem(`${POST_ENDING_PREFIX}${character.id}`);
      window.localStorage.removeItem(`affinity_${character.id}`);
      window.localStorage.removeItem(`${AWAITING_PREFIX}${character.id}`);
      clearCachedAnalysis(character.id);
      clearIntimateSecretShown(character.id);
    }
  }, [character, setAffinity, setAwaitingTeaOuting, setAwaitingDrinkOuting, setAwaitingProposalDate]);

  /** 開発デモ用：会話せず親密度のみ変更（解放トーストやデート進行も同期） */
  const applyDemoAffinity = useCallback(
    (nextRaw: number) => {
      const newAffinity = clampAffinity(nextRaw, affinityMax);
      setAffinity((prevAff) => {
        const delta = newAffinity - prevAff;
        if (delta !== 0) {
          setAffinityPulse({
            delta,
            timestamp: Date.now(),
          });
        }
        return newAffinity;
      });
      setDateProgress((prevProgress) => {
        const updated = evaluateUnlocks(newAffinity, prevProgress, character);
        if (!prevProgress.unlockedDrink && updated.unlockedDrink) {
          queueMicrotask(() =>
            setUnlockToast("🍶 「飲みに誘う」が解放されました")
          );
        } else if (!prevProgress.unlockedTea && updated.unlockedTea) {
          queueMicrotask(() =>
            setUnlockToast("🍵 「お茶に誘う」が解放されました")
          );
        }
        return updated;
      });
    },
    [character, setAffinity, affinityMax]
  );

  const handleInvite = useCallback(
    async (type: DateInviteType) => {
      const userMessage =
        type === "tea"
          ? character.teaInviteUserMessage?.trim() ||
            DEFAULT_TEA_INVITE_USER_MESSAGE
          : character.drinkInviteUserMessage?.trim() ||
            DEFAULT_DRINK_INVITE_USER_MESSAGE;

      setPendingInviteAcceptance(type);
      try {
        await sendMessage(userMessage, {
          inviteAcceptance: type,
        });
      } finally {
        setPendingInviteAcceptance(null);
      }
    },
    [
      character.drinkInviteUserMessage,
      character.teaInviteUserMessage,
      sendMessage,
    ]
  );

  const handleProposalAccept = useCallback(() => {
    if (bgmEnabled) {
      try {
        const se = new Audio("/audio/proposal-accept.mp3");
        se.volume = 0.7;
        void se.play();
      } catch { /* ignore */ }
    }
    router.push(`/ending/${character.id}`);
  }, [character.id, router, bgmEnabled]);

  const handleProposalDecline = useCallback(() => {
    setProposalDelivered(true);
    setProposalChoiceMsgId(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.proposalChoices ? { ...m, proposalChoices: false } : m
      )
    );
    setAffinity((prev) => clampAffinity(prev - 20, affinityMax));
  }, [affinityMax]);

  const teaDatePortraitSrc = useMemo(() => {
    return (
      character.teaDatePortraitSrc ?? pickCharacterPortrait(character, affinity)
    );
  }, [affinity, character]);

  const adjustAffinityFromCafeDelta = useCallback(
    (delta: number) => {
      setAffinity((prev) => clampAffinity(prev + delta, affinityMax));
    },
    [setAffinity, affinityMax]
  );

  const completeTeaVenueTurn = useCallback(() => {
    setSceneState((prev) =>
      prev.mode === "cafe" || prev.mode === "bar"
        ? { ...prev, turnsInScene: prev.turnsInScene + 1 }
        : prev
    );
  }, []);

  /** 暗転 → タイトルカード表示 → シーン切り替え → 明転 の共通シーケンス */
  const enterSceneWithTitleCard = useCallback(
    (
      card: { emoji: string; name: string; sub?: string } | null,
      switchFn: () => void
    ) => {
      setSceneDim(true);
      if (card) {
        window.setTimeout(() => {
          setSceneTitleCard(card);
          window.setTimeout(() => setSceneTitleVisible(true), 60);
        }, 320);
        window.setTimeout(() => setSceneTitleVisible(false), 1300);
        window.setTimeout(() => {
          switchFn();
        }, 1550);
        window.setTimeout(() => {
          setSceneDim(false);
          setSceneTitleCard(null);
        }, 1700);
      } else {
        window.setTimeout(() => {
          switchFn();
          window.setTimeout(() => setSceneDim(false), 120);
        }, 300);
      }
    },
    []
  );

  const enterTeaDateCafeScene = useCallback(() => {
    const name = character.teaDateLocationName ?? "喫茶店";
    enterSceneWithTitleCard(
      { emoji: "☕", name, sub: "— お茶の時間 —" },
      () => {
        conversationEpochRef.current += 1;
        setTeaDateSessionKey((k) => k + 1);
        setAwaitingTeaOuting(false);
        setSceneState(venueSceneState("cafe"));
        setSending(false);
        setError(null);
        setAffinityPulse(null);
      }
    );
  }, [setAwaitingTeaOuting, enterSceneWithTitleCard, character.teaDateLocationName]);

  const enterBarVenueScene = useCallback(() => {
    const name = character.barDateLocationName ?? "居酒屋";
    enterSceneWithTitleCard(
      { emoji: "🍶", name, sub: "— 夜のお酒 —" },
      () => {
        conversationEpochRef.current += 1;
        setTeaDateSessionKey((k) => k + 1);
        setAwaitingDrinkOuting(false);
        setSceneState(venueSceneState("bar"));
        setSending(false);
        setError(null);
        setAffinityPulse(null);
      }
    );
  }, [setAwaitingDrinkOuting, enterSceneWithTitleCard, character.barDateLocationName]);

  const enterOvernightStayScene = useCallback(() => {
    enterSceneWithTitleCard(
      { emoji: "🌙", name: "彼の部屋", sub: "— お泊まりの夜 —" },
      () => {
        conversationEpochRef.current += 1;
        setTeaDateSessionKey((k) => k + 1);
        setSceneState(overnightSceneState());
        setSending(false);
        setError(null);
        setAffinityPulse(null);
      }
    );
  }, [enterSceneWithTitleCard]);

  const enterProposalDateScene = useCallback(() => {
    const name = character.proposalDateLocationName;
    enterSceneWithTitleCard(
      name ? { emoji: "💍", name } : null,
      () => {
        conversationEpochRef.current += 1;
        setTeaDateSessionKey((k) => k + 1);
        setAwaitingProposalDate(false);
        setSceneState(proposalSceneState());
        setSending(false);
        setError(null);
        setAffinityPulse(null);
      }
    );
  }, [setAwaitingProposalDate, enterSceneWithTitleCard, character.proposalDateLocationName]);

  /** 開発デモ用：シーンに直行（teaCount/drinkCount を強制的に満たしてからシーンへ） */
  const handleDemoJump = useCallback(
    (scene: DemoScene) => {
      if (scene === "tea") {
        const th = character.teaInviteThreshold ?? 75;
        const newAff = Math.max(affinity, th);
        setAffinity(newAff);
        setDateProgress((prev) => {
          const next = evaluateUnlocks(newAff, prev, character);
          return { ...next, unlockedTea: true };
        });
        enterTeaDateCafeScene();
      } else if (scene === "bar") {
        const reqTea = character.requiredTeaCountForDrink ?? 2;
        const drinkTh = character.drinkInviteThreshold ?? 85;
        const newAff = Math.max(affinity, drinkTh);
        setAffinity(newAff);
        setDateProgress((prev) => {
          const next = evaluateUnlocks(newAff, prev, character);
          return {
            ...next,
            unlockedTea: true,
            unlockedDrink: true,
            teaCount: Math.max(next.teaCount, reqTea),
          };
        });
        enterBarVenueScene();
      } else {
        const propTh = typeof character.proposalThreshold === "number"
          ? character.proposalThreshold
          : 95;
        const reqTea = character.requiredTeaCountForDrink ?? 2;
        const newAff = Math.max(affinity, propTh);
        setAffinity(newAff);
        setDateProgress((prev) => {
          const next = evaluateUnlocks(newAff, prev, character);
          return {
            ...next,
            unlockedTea: true,
            unlockedDrink: true,
            teaCount: Math.max(next.teaCount, reqTea),
            drinkCount: Math.max(next.drinkCount, 1),
          };
        });
        enterProposalDateScene();
      }
    },
    [
      affinity,
      character,
      setAffinity,
      enterTeaDateCafeScene,
      enterBarVenueScene,
      enterProposalDateScene,
    ]
  );

  const finishProposalDateAndAccept = useCallback(() => {
    setFadingToEnding(true);
    window.setTimeout(() => router.push(`/ending/${character.id}`), 900);
  }, [character.id, router]);

  const finishProposalDateAndDecline = useCallback(() => {
    conversationEpochRef.current += 1;
    setSceneState(lineSceneState());
    setTeaDateSessionKey((k) => k + 1);
    setAffinity((prev) => clampAffinity(prev - 20, affinityMax));
    window.setTimeout(() => setSceneDim(false), 380);
  }, [affinityMax]);

  const interruptBarVenueWithoutProgress = useCallback(() => {
    // onBeforeLeave 経由で sceneDim=true になった後にここが呼ばれる
    conversationEpochRef.current += 1;
    setSceneState(lineSceneState());
    setTeaDateSessionKey((k) => k + 1);
    window.setTimeout(() => setSceneDim(false), 380);
  }, []);

  const finishBarDateAndReturnLine = useCallback(() => {
    conversationEpochRef.current += 1;
    setSceneState(lineSceneState());

    const bonus =
      typeof character.barDateAffinityBonusOnLeave === "number"
        ? Math.round(character.barDateAffinityBonusOnLeave)
        : DEFAULT_BAR_LEAVE_AFFINITY_BONUS;
    const cappedBonus = Math.max(-100, Math.min(100, bonus));
    const nextAffinity = clampAffinity(affinityRef.current + cappedBonus, affinityMax);

    setAffinity(nextAffinity);
    setAffinityPulse({ delta: cappedBonus, timestamp: Date.now() });

    setDateProgress((prevProgress) => {
      const bumped = incrementDateCount(prevProgress, "drink");
      return evaluateUnlocks(nextAffinity, bumped, character);
    });

    const farewellSource =
      character.barDateClosingAssistantMessage?.trim() ||
      DEFAULT_BAR_DATE_FAREWELL_LINE;
    const farewellLineBar = interpolateUserName(
      farewellSource,
      userProfile?.name ?? ""
    );

    setMessages((prev) => [
      ...prev,
      {
        id: newId(),
        role: "assistant",
        content: farewellLineBar,
        createdAt: Date.now(),
        affinityChange: cappedBonus,
      },
    ]);

    setTeaDateSessionKey((k) => k + 1);
    window.setTimeout(() => setSceneDim(false), 380);
  }, [character, setAffinity, affinityMax, userProfile?.name]);

  const finishTeaDateAndReturnLine = useCallback(() => {
    conversationEpochRef.current += 1;
    setSceneState(lineSceneState());

    setDateProgress((prevProgress) => {
      const bumped = incrementDateCount(prevProgress, "tea");
      const nextProgress = evaluateUnlocks(
        affinityRef.current,
        bumped,
        character
      );
      if (!prevProgress.unlockedDrink && nextProgress.unlockedDrink) {
        queueMicrotask(() =>
          setUnlockToast("🍶 「飲みに誘う」が解放されました")
        );
      }
      return nextProgress;
    });

    const farewellSource =
      character.teaDateClosingAssistantMessage?.trim() ||
      DEFAULT_TEA_DATE_FAREWELL_LINE;
    const farewellLine = interpolateUserName(
      farewellSource,
      userProfile?.name ?? ""
    );

    setMessages((prev) => [
      ...prev,
      {
        id: newId(),
        role: "assistant",
        content: farewellLine,
        createdAt: Date.now(),
      },
    ]);

    setTeaDateSessionKey((k) => k + 1);
    window.setTimeout(() => setSceneDim(false), 380);
  }, [character, userProfile?.name]);

  const interruptTeaDateCafeWithoutProgress = useCallback(() => {
    conversationEpochRef.current += 1;
    setSceneState(lineSceneState());
    setTeaDateSessionKey((k) => k + 1);
    window.setTimeout(() => setSceneDim(false), 380);
  }, []);

  const finishOvernightStayAndReturnLine = useCallback(() => {
    conversationEpochRef.current += 1;
    setSceneState(lineSceneState());
    setTeaDateSessionKey((k) => k + 1);
    window.setTimeout(() => setSceneDim(false), 380);
  }, []);

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

  const isLoading = sending;

  return (
    <main
      data-chat-root
      data-chat-mode={mode}
      {...(sceneEvent?.id
        ? { "data-scene-event-id": sceneEvent.id }
        : {})}
      className={`relative mx-auto grid h-dvh w-full max-w-full grid-rows-[auto_1fr] bg-rose-50/40 md:max-w-6xl md:grid-cols-[2fr_3fr] md:grid-rows-1 ${shellToneClass}`}
    >
      {/* シーン遷移暗転オーバーレイ（z-[99]：会場パネルの z-[100] より一段下） */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[99] bg-black transition-opacity"
        style={{
          opacity: sceneDim ? 1 : 0,
          transitionDuration: sceneDim ? "280ms" : "400ms",
          transitionTimingFunction: sceneDim ? "ease-in" : "ease-out",
        }}
      />
      {/* エンディング遷移時の白フェードオーバーレイ */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[120] bg-white transition-opacity"
        style={{
          opacity: fadingToEnding ? 1 : 0,
          transitionDuration: fadingToEnding ? "800ms" : "0ms",
          transitionTimingFunction: "ease-in-out",
        }}
      />
      {/* シーンタイトルカード（暗転の上に重ねて表示） */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[101] flex flex-col items-center justify-center transition-opacity duration-500"
        style={{ opacity: sceneTitleVisible ? 1 : 0 }}
      >
        {sceneTitleCard ? (
          <div className="text-center">
            <p className="mb-2 text-3xl">{sceneTitleCard.emoji}</p>
            <p className="text-lg font-light tracking-[0.3em] text-white/90 sm:text-xl">
              {sceneTitleCard.name}
            </p>
            {sceneTitleCard.sub ? (
              <p className="mt-2 text-xs tracking-[0.15em] text-white/50 sm:text-sm">
                {sceneTitleCard.sub}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <UnlockToast
        message={unlockToast}
        onDismiss={() => setUnlockToast(null)}
      />
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

      {/* モバイル: 上に立ち絵 24vh（旧40vh比で下の会話 flex 領域が約1.5倍）/ PC: 左カラム */}
      <aside className="flex h-[24vh] shrink-0 items-center justify-center border-b border-rose-100 bg-gradient-to-b from-white to-rose-50/70 px-3 py-2 md:h-full md:min-h-0 md:border-b-0 md:border-r md:bg-gradient-to-br md:from-white md:to-rose-50/80">
        <div className="w-[min(100%,calc(24vh*9/16))] max-h-[24vh] shrink-0 md:max-h-[min(85vh,720px)] md:w-full md:max-w-[320px]">
          <CharacterPortrait affinity={affinity} character={character} />
        </div>
      </aside>

      {/* チャット本体 */}
      <section className="flex min-h-0 flex-col overflow-hidden bg-rose-50/40">
        {/* ヘッダー：左プロフィール / 中央ハート / 右リセット・BGM（狭い画面でも被らないよう3カラム） */}
        <header className="sticky top-0 z-10 flex shrink-0 flex-col border-b border-rose-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex min-h-[3.25rem] items-center gap-2 px-2 py-2 sm:gap-3 sm:px-4 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              <Link
                href="/"
                className="shrink-0 rounded-full px-2 py-1 text-sm text-slate-500 transition hover:bg-rose-50 hover:text-rose-500"
                aria-label="ホームに戻る"
              >
                ‹
              </Link>
              <div className="flex min-w-0 flex-1 items-center gap-2">
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
                <div className="min-w-0 flex-1 overflow-hidden leading-tight">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {character.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {character.occupation}
                  </p>
                </div>
              </div>
            </div>
            {/* ハートは中央カラムではなく右寄せクラスタ先頭に置き、プロフィールと被らないようにする */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div className="shrink-0 pl-1">
                <HeartIndicator affinity={affinity} pulse={affinityPulse} />
              </div>
              {showResetButton ? (
                <button
                  type="button"
                  onClick={() => {
                    if (bgmEnabled) { try { const se = new Audio("/audio/ui-click.mp3"); se.volume = 0.5; void se.play(); } catch { /* ignore */ } }
                    handleReset();
                  }}
                  className="shrink-0 rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-600 transition hover:border-rose-200 hover:text-rose-600 sm:px-2.5 sm:text-[11px]"
                >
                  リセット
                </button>
              ) : null}
              <BgmToggleButton />
            </div>
          </div>
          {showAffinityDemoTools ? (
            <AffinityDemoToolbar
              affinity={affinity}
              initialAffinity={character.initialAffinity}
              proposalThreshold={
                typeof proposalThreshold === "number"
                  ? proposalThreshold
                  : undefined
              }
              onSetAffinity={applyDemoAffinity}
              onJumpToScene={handleDemoJump}
            />
          ) : null}
        </header>

        {/* メッセージ一覧 */}
        <div
          ref={scrollRef}
          className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-2"
        >
          {!historyHydrated || !affinityHydrated ? (
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
                proposalActions={
                  m.proposalChoices && m.id === proposalChoiceMsgId
                    ? {
                        onAccept: handleProposalAccept,
                        onDecline: handleProposalDecline,
                      }
                    : undefined
                }
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
          {awaitingProposalDate ? (
            <button
              type="button"
              onClick={() => {
                if (bgmEnabled) { try { const se = new Audio("/audio/ui-click.mp3"); se.volume = 0.5; void se.play(); } catch { /* ignore */ } }
                enterProposalDateScene();
              }}
              disabled={isLoading || venueUiOpen}
              className="flex w-full items-center justify-center rounded-xl border-2 border-rose-300/80 bg-gradient-to-b from-rose-50/95 to-white px-4 py-3.5 text-sm font-semibold tracking-wide text-rose-900 shadow-[0_1px_0_rgba(0,0,0,0.06)] transition hover:border-rose-400 hover:from-rose-50 hover:to-rose-50/80 disabled:opacity-50"
            >
              ✨ 特別なデートに行く
            </button>
          ) : null}
          {awaitingTeaOuting ? (
            <button
              type="button"
              onClick={() => {
                if (bgmEnabled) { try { const se = new Audio("/audio/ui-click.mp3"); se.volume = 0.5; void se.play(); } catch { /* ignore */ } }
                enterTeaDateCafeScene();
              }}
              disabled={isLoading || proposalPending || venueUiOpen}
              className="flex w-full items-center justify-center rounded-xl border-2 border-amber-200/90 bg-gradient-to-b from-amber-50/95 to-white px-4 py-3.5 text-sm font-semibold tracking-wide text-amber-950 shadow-[0_1px_0_rgba(0,0,0,0.06)] transition hover:border-amber-300 hover:from-amber-50 hover:to-amber-50/80 disabled:opacity-50"
            >
              ☕ 一緒にお茶しに行く
            </button>
          ) : null}
          {awaitingDrinkOuting ? (
            <button
              type="button"
              onClick={() => {
                if (bgmEnabled) { try { const se = new Audio("/audio/ui-click.mp3"); se.volume = 0.5; void se.play(); } catch { /* ignore */ } }
                enterBarVenueScene();
              }}
              disabled={isLoading || proposalPending || venueUiOpen}
              className="flex w-full items-center justify-center rounded-xl border-2 border-indigo-400/80 bg-gradient-to-b from-indigo-950/95 via-slate-900 to-indigo-950 px-4 py-3.5 text-sm font-semibold tracking-wide text-rose-50 shadow-[0_1px_0_rgba(0,0,0,0.2)] transition hover:border-rose-300/70 disabled:opacity-50"
            >
              🌃 一緒に飲みに行く
            </button>
          ) : null}
          {postEnding && sceneState.mode === "line" ? (
            <button
              type="button"
              onClick={() => {
                if (bgmEnabled) { try { const se = new Audio("/audio/ui-click.mp3"); se.volume = 0.5; void se.play(); } catch { /* ignore */ } }
                enterOvernightStayScene();
              }}
              disabled={isLoading || proposalPending || venueUiOpen}
              className="flex w-full items-center justify-center rounded-xl border-2 border-fuchsia-300/80 bg-gradient-to-b from-fuchsia-50/95 to-white px-4 py-3.5 text-sm font-semibold tracking-wide text-fuchsia-900 shadow-[0_1px_0_rgba(0,0,0,0.06)] transition hover:border-fuchsia-400 hover:from-fuchsia-50 hover:to-fuchsia-50/80 disabled:opacity-50"
            >
              🌙 お泊まりする
            </button>
          ) : null}
          <DateInviteButtons
            progress={dateProgress}
            onInvite={(t) => void handleInvite(t)}
            disabled={
              isLoading ||
              proposalPending ||
              pendingInviteAcceptance !== null ||
              awaitingTeaOuting ||
              awaitingDrinkOuting ||
              awaitingProposalDate ||
              venueUiOpen
            }
          />
          {/* スタンプ */}
          <StampPicker
            stamps={stampDefinitions}
            disabled={isLoading || proposalPending || venueUiOpen}
            onPick={handleStampPick}
          />
          {mode === "call" ? (
            <div
              className="sr-only"
              aria-hidden
              data-voice-input-slot="reserved"
            />
          ) : null}
          {/* 入力欄 */}
          <MessageInput
            onSubmit={sendMessage}
            disabled={isLoading || proposalPending || venueUiOpen}
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
              onClick={() => {
                if (bgmEnabled) { try { const se = new Audio("/audio/ui-click.mp3"); se.volume = 0.5; void se.play(); } catch { /* ignore */ } }
                goAnalyze();
              }}
              disabled={userMessageCount < 1}
              className="rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              分析する →
            </button>
          </div>
        </footer>
      </section>

      {sceneState.mode === "cafe" ? (
        <TeaDateCafePanel
          key={teaDateSessionKey}
          character={character}
          affinity={affinity}
          affinityPulse={affinityPulse}
          userName={chatUserName}
          introTemplateUserName={userProfile?.name ?? ""}
          portraitSrc={teaDatePortraitSrc}
          turnsInScene={sceneState.turnsInScene}
          minTurns={sceneState.minTurns}
          maxTurns={sceneState.maxTurns}
          onVenueTurnCompleted={completeTeaVenueTurn}
          onAffinityDelta={adjustAffinityFromCafeDelta}
          onFinishedTeaDate={finishTeaDateAndReturnLine}
          onInterruptTeaDate={interruptTeaDateCafeWithoutProgress}
          onBeforeLeave={() => setSceneDim(true)}
          postEndingCouplePlay={postEnding}
        />
      ) : null}
      {sceneState.mode === "bar" ? (
        <BarVenuePanel
          key={teaDateSessionKey}
          character={character}
          affinity={affinity}
          affinityPulse={affinityPulse}
          userName={chatUserName}
          introTemplateUserName={userProfile?.name ?? ""}
          portraitSrc={teaDatePortraitSrc}
          hidePortraitStrip={character.teaDateHidePortraitStrip === true}
          turnsInScene={sceneState.turnsInScene}
          minTurns={sceneState.minTurns}
          maxTurns={sceneState.maxTurns}
          onVenueTurnCompleted={completeTeaVenueTurn}
          onAffinityDelta={adjustAffinityFromCafeDelta}
          onFinishedBarDate={finishBarDateAndReturnLine}
          onInterruptBarDate={interruptBarVenueWithoutProgress}
          onBeforeLeave={() => setSceneDim(true)}
          postEndingCouplePlay={postEnding}
        />
      ) : null}
      {sceneState.mode === "overnight" ? (
        <OvernightStayPanel
          key={teaDateSessionKey}
          character={character}
          affinity={affinity}
          affinityPulse={affinityPulse}
          portraitSrc={teaDatePortraitSrc}
          onAffinityDelta={adjustAffinityFromCafeDelta}
          onFinishedOvernightStay={finishOvernightStayAndReturnLine}
          onBeforeLeave={() => setSceneDim(true)}
        />
      ) : null}
      {sceneState.mode === "proposal" ? (
        <ProposalDatePanel
          key={teaDateSessionKey}
          character={character}
          affinity={affinity}
          affinityPulse={affinityPulse}
          introTemplateUserName={userProfile?.name ?? ""}
          portraitSrc={teaDatePortraitSrc}
          onAccept={finishProposalDateAndAccept}
          onDecline={finishProposalDateAndDecline}
          onBeforeLeave={() => setSceneDim(true)}
        />
      ) : null}
    </main>
  );
}
