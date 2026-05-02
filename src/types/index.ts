export type Role = "user" | "assistant" | "system";

export type CharacterImageSet = {
  baseline: string;
  happy: string;
  cool: string;
};

export type CharacterBackstory = {
  marriage: string;
  reason: string;
  current: string;
};

export type CharacterConfig = {
  id: string;
  name: string;
  displayName: string;
  age: number;
  occupation: string;
  backstory: CharacterBackstory;
  surfacePrompt: string;
  innerPrompt: string;
  initialAffinity: number;
  greeting: string;
  /** 立ち絵・表情差分（public 配下のパス） */
  images: CharacterImageSet;
  /** 好感度がこの値以上でプロポーズ発動の基準となる */
  proposalThreshold?: number;
  /** プロポーズ本文（送信時は通常チャットレスポンスの代わりに表示） */
  proposalMessage?: string;
  /** お茶デート誘いフロー開始の好感度閾値（未指定時は 75） */
  teaInviteThreshold?: number;
  /** 飲みデート誘いフロー開始の好感度閾値（未指定時は 85） */
  drinkInviteThreshold?: number;
  /** 飲み誘いに必要なお茶回数の下限（未指定時は 2） */
  requiredTeaCountForDrink?: number;
  /** プロポーズまでに必要な飲み回数の下限（未指定時は 2） */
  requiredDrinkCountForProposal?: number;
  /** 「お茶に誘う」ボタン押下時にユーザー発言として送る固定文 */
  teaInviteUserMessage?: string;
  /** 「飲みに誘う」ボタン押下時にユーザー発言として送る固定文 */
  drinkInviteUserMessage?: string;
  /** お茶誘いを承諾させるための、一時的な system prompt 上書き */
  teaAcceptanceSystemPrompt?: string;
  /** 飲み誘いを承諾させるための、一時的な system prompt 上書き */
  drinkAcceptanceSystemPrompt?: string;
};

/** 複数キャラ対応時のエイリアス */
export type Character = CharacterConfig;

export type ProposalState = {
  /** 好感度が閾値以上で true */
  isReady: boolean;
  /** 「もう少し考える」を選んでいるとき true（localStorage と同期） */
  delivered: boolean;
};

/** お茶・飲みデートなどの進行（将来の UI / 永続化用） */
export type DateProgress = {
  teaCount: number;
  drinkCount: number;
  /** 一度 75 到達したら true（戻らない） */
  unlockedTea: boolean;
  /** 85 到達かつ teaCount>=2 で true（戻らない） */
  unlockedDrink: boolean;
};

export type DateInviteType = "tea" | "drink";

/** 好感度レンジに応じたハート演出フェーズ */
export type HeartPhase =
  | "idle" // 0-19
  | "soft" // 20-39
  | "warm" // 40-59
  | "beat" // 60-74
  | "fast" // 75-84
  | "passion" // 85-94
  | "intense"; // 95-100

/** 好感度バーなどのパルス演出トリガー用 */
export type AffinityPulse = {
  delta: number;
  timestamp: number;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  stampId?: string;
  stampLabel?: string;
  inner?: string;
  affinityChange?: number;
  /** このメッセージの下にプロポーズ応答ボタンを付ける */
  proposalChoices?: boolean;
};

export type ChatResponseBody = {
  reply: string;
  inner: string;
  affinityChange: number;
};

export type AnalysisAxes = {
  listening: number;
  expressing: number;
  acting: number;
  protecting: number;
  perceiving: number;
};

export type AnalysisResult = {
  totalScore: number;
  axes: AnalysisAxes;
  goodPoints: string[];
  improvements: string[];
  comment: string;
};

/** チャット表示モード。現状は line のみ。scene / call は将来対応 */
export type ChatMode = "line" | "scene" | "call";

/** シーンイベントの拡張用プレースホルダー型（イベント再生・個別画像等は未実装） */
export type SceneEvent = {
  id: string;
  triggerAffinity: number;
  location: string;
  backgroundImage: string;
  characterImage: string;
  introMessage: string;
  systemPromptOverride: string;
};
