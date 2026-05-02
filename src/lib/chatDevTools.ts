/**
 * チャット画面の開発者向け UI 表示条件。
 * - `npm run dev` ではデモツール（親密度スライダー等）を標準表示
 * - 本番ビルドでハッカソン即席デモには `NEXT_PUBLIC_DEV_TOOLS=1`
 */
export function showChatAffinityDemoTools(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_DEV_TOOLS === "1"
  );
}

/** 「リセット」はローカル開発時のみ（本番ビルドでは非表示） */
export function showChatResetButton(): boolean {
  return process.env.NODE_ENV === "development";
}
