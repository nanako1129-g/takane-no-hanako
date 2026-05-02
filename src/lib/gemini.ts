import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    "[gemini] GEMINI_API_KEY が未設定です。.env.local を確認してください。"
  );
}

export const genAI = new GoogleGenerativeAI(apiKey ?? "");

export const MODEL_NAME = "gemini-flash-lite-latest";

export function getModel(systemInstruction?: string) {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
  });
}

export interface SimpleHistoryItem {
  role: "user" | "assistant";
  content: string;
}

/**
 * Gemini の chat history は先頭が必ず user ロールであり、かつ user / model が交互である必要がある。
 * - 先頭に assistant だけ並ぶ場合は、最初の user までを捨てる。
 * - 連続した同一ロールは本文を結合して 1 メッセージにまとめる（SDK のバリデーション回避）。
 */
export function toGeminiHistory(messages: SimpleHistoryItem[]) {
  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  if (firstUserIdx === -1) return [];

  const flattened: SimpleHistoryItem[] = [];
  for (let i = firstUserIdx; i < messages.length; i++) {
    const m = messages[i];
    const last = flattened[flattened.length - 1];
    if (
      last &&
      last.role === m.role &&
      typeof last.content === "string" &&
      typeof m.content === "string"
    ) {
      const joined = `${last.content}\n${m.content}`.trim();
      flattened[flattened.length - 1] = { role: last.role, content: joined };
    } else {
      flattened.push({ role: m.role, content: m.content });
    }
  }

  return flattened.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

/**
 * 渡されたテキストから先頭/末尾のコードフェンスを除去し、
 * JSON 部分だけを安全に取り出す。
 */
export function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceRemoved = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = fenceRemoved.indexOf("{");
  const lastBrace = fenceRemoved.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return fenceRemoved;
  }
  return fenceRemoved.slice(firstBrace, lastBrace + 1);
}
