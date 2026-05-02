import ChatExperience from "@/components/ChatExperience";

/**
 * チャットエントリ。現状は常に LINE風レイアウト。
 * 将来: `mode` や検索クエリで `scene` / `call` を渡すだけで差し替え可能。
 */
export default function ChatPage({
  params,
}: {
  params: { charId: string };
}) {
  return <ChatExperience charId={params.charId} mode="line" />;
}
