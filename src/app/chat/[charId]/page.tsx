import ChatExperience from "@/components/ChatExperience";

/**
 * チャットエントリ。LINE風レイアウト。
 * 好感度がキャラ設定の proposalThreshold に達すると、送信時にプロポーズ特殊応答になり、
 * 受諾時は `/ending/[charId]` へ（ロジックは ChatExperience）。
 */
export default function ChatPage({
  params,
}: {
  params: { charId: string };
}) {
  return <ChatExperience charId={params.charId} mode="line" />;
}
