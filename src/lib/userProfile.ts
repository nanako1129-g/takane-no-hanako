/** プレイヤー（ユーザー）側のプロフィール。ローカル永続化用 */
export type UserProfile = {
  name: string;
  createdAt: number;
};

/** 表示名の最大文字数（UTF-16 単位）。API の `LIMITS.MAX_PLAYER_DISPLAY_NAME` と一致させること */
export const USER_NAME_MAX_LEN = 12;

function stripNullBytes(s: string): string {
  return s.includes("\u0000") ? s.replace(/\u0000/g, "") : s;
}

/**
 * 前後の空白除去、最大12文字。記号のみ等は空文字。
 * （日本語名前を許可するため文字種で判定）
 */
export function sanitizeUserName(input: string): string {
  const trimmed = stripNullBytes(input).trim().slice(0, USER_NAME_MAX_LEN);
  if (!trimmed || /[\n\r<>]/.test(trimmed)) return "";
  if (
    !/[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\u3005\u3006\u30FCa-zA-Z0-9_]/.test(
      trimmed
    )
  ) {
    return "";
  }
  return trimmed;
}

export {
  clearUserProfile,
  loadUserProfile,
  STORAGE_KEY,
  saveUserProfile,
} from "./playerNameStorage";
