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
  /** プロポーズ本文（ProposalDatePanel 内で自動表示） */
  proposalMessage?: string;
  /** プロポーズデートへの誘い文（LINE 上でキャラが発言。未設定時はデフォルト） */
  proposalDateInviteAssistantMessage?: string;
  /** プロポーズデート場所に着いたときのイントロセリフ（未設定時はデフォルト） */
  proposalDateIntroAssistantMessage?: string;
  /** プロポーズデートの場所画像（public/ 配下のパス。未設定時はプレースホルダー） */
  proposalDateSceneSrc?: string;
  /**
   * プロポーズデートのシーン画像リスト（6枚対応）。
   * [0] 誰もいない公園, [1] 登場, [2] 歩く, [3] プロポーズ真剣, [4] ブレスレット, [5] 笑顔
   * 設定時は proposalDateSceneSrc より優先。
   */
  proposalDateSceneSrcs?: string[];
  /**
   * アシスタントの返答を表示するまでの見かけの遅延（ms）。両方あるときのみ有効。
   * 体感の「間」用。下限〜上限の間を好感度に応じて偏らせたランダムにする。
   */
  assistantReplyDelayMinMs?: number;
  assistantReplyDelayMaxMs?: number;
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
  /** 喫茶店シーン遷移時に表示するロケーション名（未設定時は「喫茶店」） */
  teaDateLocationName?: string;
  /** 居酒屋シーン遷移時に表示するロケーション名（未設定時は「居酒屋」） */
  barDateLocationName?: string;
  /** プロポーズデートシーン遷移時に表示するロケーション名（未設定時は非表示） */
  proposalDateLocationName?: string;
  /** 喫茶店シーン中のチャットに付与する表面プロンプト（お茶デート運用の世界観） */
  teaDateScenePrompt?: string;
  /**
   * 喫茶店シーン専用の追加指示。
   * 文中の `${turnsInScene}` と `${maxTurns}` は API がリクエスト値で文字列置換する（テンプレ内では `\$\{…\}` のように書く）。
   */
  cafeSceneSystemPrompt?: string;
  /**
   * バー（飲み）シーン用の追加指示（ターン `\$\{…\}` は café と同様に API が置換）。
   */
  barSceneSystemPrompt?: string;
  /** 喫茶店シーン開始直後のアシスタント冒頭一言 */
  teaDateIntroAssistantMessage?: string;
  /** バー（飲み）シーン開始直後のアシスタント冒頭一言（`{userName}` 可） */
  barIntroAssistantMessage?: string;
  /** 喫茶店後LINE復帰で流す締めのメッセージ */
  teaDateClosingAssistantMessage?: string;
  /** バー（飲みデート）後LINE復帰で流す締めのメッセージ（`{userName}` 可） */
  barDateClosingAssistantMessage?: string;
  /** 喫茶店背景を1枚だけ使う場合（`/public` からのパス）。`teaDateEmptyBackgroundSrc` と両方ある場合は二枚組を優先 */
  teaDateBackgroundSrc?: string;
  /** 喫茶店・空席（例: cafe_empty.png）。`teaDateWithCharacterBackgroundSrc` とセットで着席へフェード */
  teaDateEmptyBackgroundSrc?: string;
  /** 喫茶店・着席後（例: cafe_with_him.png） */
  teaDateWithCharacterBackgroundSrc?: string;
  /** 喫茶店での立ち絵。未指定はメインゲームと同一ロジック */
  teaDatePortraitSrc?: string;
  /** true のとき画面上部の立ち絵ストリップを隠す（複合背景で人物が被る場合など）。吹き出しアバターには teaDatePortraitSrc がそのまま使われる */
  teaDateHidePortraitStrip?: boolean;
  /** バー個室・相手入室後の背景 */
  barDateWithCharacterBackgroundSrc?: string;
  /**
   * バーシーン最初に表示する「到着・着席」画像。
   * 設定すると入場直後はこの画像が手前に表示され、1ターン会話後に
   * `barDateWithCharacterBackgroundSrc` へクロスフェードする。
   */
  barDateArrivalSrc?: string;
  /** バー個室・誰もいない状態の背景（`barDateWithCharacterBackgroundSrc` と併せて順にフェード）。未設定で相手のみ指定した場合は単一背景として表示 */
  barDateEmptyBackgroundSrc?: string;
  /** バー入室前の場所テロップ／未設定時は共通デフォルト */
  barDateLocationTelop?: string;
  /**
   * バーで「言葉が落ち着いた一拍」などに差し込むヒーロー画像（東京タワー夜景・横顔など）。
   * `barDateSilenceHeroTurnMin`〜`TurnMax` の `turnsInScene` の間だけ最背面レイヤーの上に表示する。
   */
  barDateSilenceHeroSrc?: string;
  /** ヒーロー画像を重ねる区間開始（既定: ５ターン目前後の一拍＝完了ターン **4** から表示） */
  barDateSilenceHeroTurnMin?: number;
  /** ヒーロー画像を重ねる区間終了（既定: **5** まで／５往復終了まで） */
  barDateSilenceHeroTurnMax?: number;
  /**
   * 「ユーザー送信時点で `turnsInScene === この数`」の往復について、AI の inner を捨てて固定文言で上書きする（API は表面返答のみ活かす）。
   * 既定 **4**（５ターン目のユーザー発話に対するアシスタント返信ぶん）。
   */
  barDateSilenceInnerOnTurnSubmit?: number;
  /** `barDateSilenceInnerOnTurnSubmit` に合致した返信にだけ差し込む固定の内心（「内心を見る」で表示） */
  barDateSilenceInnerLine?: string;
  /** バーを通常完了して LINE に戻したときの好感度加算（未指定時は 12） */
  barDateAffinityBonusOnLeave?: number;
  /** お茶誘いを承諾させるための、一時的な system prompt 上書き */
  teaAcceptanceSystemPrompt?: string;
  /** 飲み誘いを承諾させるための、一時的な system prompt 上書き */
  drinkAcceptanceSystemPrompt?: string;
  /**
   * 飲み誘いの承諾／バーシナリオ用。未設定時は `drinkAcceptanceSystemPrompt` を使う。
   */
  barInviteAcceptanceSystemPrompt?: string;
  /**
   * 「秘密の共有」: 親密性の報酬として、閾値到達後に一度だけ自動で送る独白（重くない小さめの失敗談など）。`{userName}` 可。
   */
  intimacySecretAssistantMessage?: string;
  /** 上記を挿入する好感度の下限（未指定時は `proposalThreshold`、`proposalThreshold` も無ければ 95） */
  intimacySecretAffinityThreshold?: number;
};

/** 複数キャラ対応時のエイリアス */
export type Character = CharacterConfig;

export type { UserProfile } from "@/lib/userProfile";

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
  /** アプリ自動挿入メッセージの識別（重複防止・UI での区別に使用可） */
  autoKind?: "intimacy_secret" | "bar_silence_inner";
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

/** メイン画面上の対話フェーズ（LINE／店シーン）。`ChatMode.scene` の演出用とは別 */
export type SceneMode = "line" | "cafe" | "bar" | "proposal";

/** 店シーン内のターンレンジ（ユーザー1往復≒1増分）の既定値 */
export const SCENE_TURN_LIMITS = {
  minTurns: 5,
  maxTurns: 10,
} as const;

export type SceneState = {
  mode: SceneMode;
  /** 店シーン内で完了したユーザー発話ターン数（LINE 時は 0 のまま） */
  turnsInScene: number;
  minTurns: number;
  maxTurns: number;
};

export function lineSceneState(): SceneState {
  return {
    mode: "line",
    turnsInScene: 0,
    minTurns: SCENE_TURN_LIMITS.minTurns,
    maxTurns: SCENE_TURN_LIMITS.maxTurns,
  };
}

export function venueSceneState(venue: "cafe" | "bar"): SceneState {
  return {
    mode: venue,
    turnsInScene: 0,
    minTurns: SCENE_TURN_LIMITS.minTurns,
    maxTurns: SCENE_TURN_LIMITS.maxTurns,
  };
}

/** プロポーズデートシーン用 SceneState（ターン不要） */
export function proposalSceneState(): SceneState {
  return {
    mode: "proposal",
    turnsInScene: 0,
    minTurns: 0,
    maxTurns: 0,
  };
}

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
