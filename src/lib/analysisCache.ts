import { messageContentForGemini } from "@/lib/stamps";
import type { AnalysisResult, Message } from "@/types";

const PREFIX = "analysis_";

/** チャット本文が変わったかどうかの判定に使う */
export function conversationFingerprint(messages: Message[]): string {
  return messages
    .map((m) => `${m.role}:${messageContentForGemini(m)}`)
    .join("\u241e");
}

export interface CachedAnalysis {
  result: AnalysisResult;
  fingerprint: string;
}

export function readCachedAnalysis(charId: string): CachedAnalysis | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${charId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as CachedAnalysis & { axes?: unknown };
    if (
      obj.result?.totalScore === undefined ||
      !obj.result?.axes ||
      obj.fingerprint === undefined ||
      typeof obj.fingerprint !== "string"
    ) {
      return null;
    }
    return { result: obj.result, fingerprint: obj.fingerprint };
  } catch {
    return null;
  }
}

export function writeCachedAnalysis(
  charId: string,
  data: CachedAnalysis
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${PREFIX}${charId}`,
      JSON.stringify({
        ...data,
        savedAt: Date.now(),
      })
    );
  } catch {
    // quota 等
  }
}

export function clearCachedAnalysis(charId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${PREFIX}${charId}`);
  } catch {
    // ignore
  }
}
