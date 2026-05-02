export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  inner?: string;
  affinityChange?: number;
  createdAt: number;
  /** ユーザー送信のみ。セット時は主に sticker 表示／API用は stampLabel で補完 */
  stampId?: string;
  stampLabel?: string;
}

export interface ChatRequestBody {
  charId: string;
  messages: Pick<Message, "role" | "content">[];
  userMessage: string;
  affinity: number;
}

export interface ChatResponseBody {
  reply: string;
  inner: string;
  affinityChange: number;
}

export interface AnalyzeRequestBody {
  charId: string;
  messages: Pick<Message, "role" | "content">[];
}

export interface AnalysisAxes {
  listening: number;
  expressing: number;
  acting: number;
  protecting: number;
  perceiving: number;
}

export interface AnalysisResult {
  totalScore: number;
  axes: AnalysisAxes;
  goodPoints: string[];
  improvements: string[];
  comment?: string;
}

export interface CharacterImageSet {
  /** 通常〜やや好印象（中間） */
  neutral: string;
  /** 好感度が高いときの笑顔 */
  smile: string;
  /** 距離が縮まり打ち解けたとき */
  relaxed: string;
}

export interface CharacterBackstory {
  marriage: string;
  reason: string;
  current: string;
}

export interface CharacterConfig {
  id: string;
  name: string;
  displayName: string;
  age: number;
  occupation: string;
  /** オプションの人物背景（UIや将来の拡張用） */
  backstory?: CharacterBackstory;
  surfacePrompt: string;
  innerPrompt: string;
  initialAffinity: number;
  greeting: string;
  images: CharacterImageSet;
}
