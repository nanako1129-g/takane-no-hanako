import type { SimpleHistoryItem } from "@/lib/gemini";
import { sanitizeUserName } from "@/lib/userProfile";

/** API Route 入力・出力の許容量（乱用や巨大ペイロード対策） */
export const LIMITS = {
  MAX_CHAR_ID_LEN: 64,
  MAX_USER_MESSAGE: 4096,
  MAX_MESSAGE_CONTENT: 6000,
  MAX_CHAT_HISTORY_MESSAGES: 80,
  MAX_ANALYSIS_MESSAGES: 120,
  MAX_MODEL_REPLY_CHARS: 12_000,
  MAX_SYSTEM_PROMPT_APPEND: 8192,
  /** プレイヤー呼び名（チャット system 注入用・`USER_NAME_MAX_LEN` と一致） */
  MAX_PLAYER_DISPLAY_NAME: 12,
  MAX_ANALYSIS_COMMENT: 2000,
  MAX_ANALYSIS_POINT_ITEM: 500,
  MAX_ANALYSIS_POINT_COUNT: 5,
} as const;

const CHAR_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export function sanitizeCharId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s || s.length > LIMITS.MAX_CHAR_ID_LEN) return null;
  if (!CHAR_ID_RE.test(s)) return null;
  return s;
}

export function sanitizeAffinity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** `/api/chat` のデート誘いフラグ（未指定・不正時は通常チャット） */
export function sanitizeInviteType(value: unknown): "tea" | "drink" | null {
  if (value === "tea" || value === "drink") return value;
  return null;
}

/** お茶デート／喫茶店シーン専用のチャットフラグ */
export function sanitizeTeaDateCafeFlag(value: unknown): boolean {
  return value === true;
}

/** バー／飲みシーン進行時のチャットフラグ（`teaDateCafe` と同時には立てない運用を想定） */
export function sanitizeTeaDateBarFlag(value: unknown): boolean {
  return value === true;
}

/** 喫茶店内の完了済みユーザーターン数（カフェフラグ時のみ参照） */
export function sanitizeTeaDateCafeTurnsInScene(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** 喫茶店の規定ターン上限（クリップ） */
export function sanitizeTeaDateCafeMaxTurns(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 10;
  return Math.max(1, Math.min(100, Math.round(value)));
}

/** プレイヤー表示名。空・不正時は null（system 注入なし） */
export function sanitizePlayerDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = sanitizeUserName(stripNullBytes(value));
  return stripped.length ? stripped : null;
}

export function sanitizeUserMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = stripNullBytes(value.trim()).slice(
    0,
    LIMITS.MAX_USER_MESSAGE
  );
  return stripped.length ? stripped : null;
}

export function sanitizeModelReply(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripNullBytes(value).slice(0, LIMITS.MAX_MODEL_REPLY_CHARS);
}

function stripNullBytes(s: string): string {
  return s.includes("\u0000") ? s.replace(/\u0000/g, "") : s;
}

function isRole(role: unknown): role is SimpleHistoryItem["role"] {
  return role === "user" || role === "assistant";
}

/**
 * 会話ログ（role + content のみ）を検証・上限適用する。
 */
export function sanitizeConversationMessages(
  raw: unknown,
  maxItems: number
): SimpleHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  const trimmed = raw.length > maxItems ? raw.slice(-maxItems) : raw;

  const out: SimpleHistoryItem[] = [];
  for (const item of trimmed) {
    if (!item || typeof item !== "object") continue;
    const msg = item as { role?: unknown; content?: unknown };
    const { role, content } = msg;
    if (!isRole(role)) continue;
    if (typeof content !== "string") continue;
    out.push({
      role,
      content: stripNullBytes(content).slice(0, LIMITS.MAX_MESSAGE_CONTENT),
    });
  }
  return out;
}

/** 分析JSONの短文配列フィールドを安全に切り詰める */
export function sanitizeAnalysisBullets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) =>
      stripNullBytes(v).trim().slice(0, LIMITS.MAX_ANALYSIS_POINT_ITEM)
    )
    .slice(0, LIMITS.MAX_ANALYSIS_POINT_COUNT);
}

export function sanitizeAnalysisComment(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = stripNullBytes(value).trim().slice(0, LIMITS.MAX_ANALYSIS_COMMENT);
  return s.length ? s : undefined;
}
