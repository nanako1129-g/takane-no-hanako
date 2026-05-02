/** チャット一覧用：例 14:08（24時間表記） */
export function formatChatTime(epochMs: number): string {
  if (typeof epochMs !== "number" || !Number.isFinite(epochMs)) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(epochMs));
  } catch {
    return "";
  }
}
