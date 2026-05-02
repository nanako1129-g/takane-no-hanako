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
 * Gemini の chat history は先頭が必ず user ロールである必要がある。
 * 先頭に assistant（=model）の発言が並んでいる場合は除外して、
 * 最初の user 発言から渡す。
 */
export function toGeminiHistory(messages: SimpleHistoryItem[]) {
  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  const sliced = firstUserIdx === -1 ? [] : messages.slice(firstUserIdx);
  return sliced.map((m) => ({
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
