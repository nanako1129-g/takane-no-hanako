import type { Message } from "@/types";

export interface StampDef {
  id: string;
  /** Gemini・分析で使う自然言語（「いいね」など） */
  label: string;
  /** アクセシビリティ用 */
  alt: string;
  /** 画面上のキャラ絵として使う単一絵文字 */
  emoji: string;
}

export const stamps: StampDef[] = [
  { id: "like", label: "いいね！", alt: "いいね", emoji: "👍" },
  { id: "thanks", label: "ありがとう", alt: "感謝", emoji: "🙏" },
  { id: "lol", label: "爆笑", alt: "笑っている", emoji: "🤣" },
  { id: "nod", label: "うんうん", alt: "うなずき", emoji: "👌" },
  { id: "heart", label: "好きです", alt: "ハート", emoji: "💗" },
  { id: "bow", label: "失礼しました", alt: "おじぎ", emoji: "🙇‍♂️" },
  { id: "tea", label: "おつかれさま", alt: "お茶", emoji: "🍵" },
  { id: "sleep", label: "おやすみ", alt: "おやすみ", emoji: "🌙" },
];

export const stampMap = Object.fromEntries(
  stamps.map((s) => [s.id, s])
) as Record<string, StampDef>;

export function getStamp(id?: string): StampDef | undefined {
  return id ? stampMap[id] : undefined;
}

/**
 * LLM が解釈しやすい「会話ログ上の文言」へ。
 * スタンプのみのときは content が空になるため、stampLabel から補う。
 */
export function messageContentForGemini(
  message: Pick<Message, "role" | "content" | "stampId" | "stampLabel">
): string {
  if (message.role === "user" && message.stampId && message.stampLabel) {
    return `（スタンプ「${message.stampLabel}」を送った）`;
  }
  return message.content;
}
