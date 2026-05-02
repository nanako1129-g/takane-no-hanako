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
};

/** 複数キャラ対応時のエイリアス */
export type Character = CharacterConfig;

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  stampId?: string;
  stampLabel?: string;
  inner?: string;
  affinityChange?: number;
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
