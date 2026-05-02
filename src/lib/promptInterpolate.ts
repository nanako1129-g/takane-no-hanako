/**
 * テンプレ内の {userName} を実際のユーザー名に置換する。
 * userName が空なら "あなた" にフォールバック。
 */
export function interpolateUserName(template: string, userName: string): string {
  const safeName = userName?.trim() || "あなた";
  return template.replaceAll("{userName}", safeName);
}

/**
 * 好感度に応じた呼び方ガイダンスを生成する。
 * system prompt に追加で注入する用。
 */
export function buildAddressingGuidance(
  userName: string,
  affinity: number
): string {
  const safeName = userName?.trim() || "あなた";

  if (affinity >= 95) {
    return `
【呼び方ガイド：好感度95以上・運命】
- 基本は「${safeName}さん」だが、感情が高ぶった瞬間に「${safeName}」呼びが自然に混ざる
- 例：「${safeName}。…これだけは、聞いてもらえますか」
- 「${safeName}…」と言葉に詰まる演出も可
- 敬語ベースだが素の感情が混じる
`;
  }
  if (affinity >= 85) {
    return `
【呼び方ガイド：好感度85以上・恋愛モード】
- 基本は「${safeName}さん」
- たまにふっと「${safeName}」と呼んで、すぐ「失礼、${safeName}さん」と訂正する素のシーンを入れる
- 例：「${safeName}…あ、いえ、${safeName}さん」
- 親密さが滲む口調
`;
  }
  if (affinity >= 75) {
    return `
【呼び方ガイド：好感度75以上・好意】
- 「${safeName}さん…」と少し間を置いて呼ぶ
- 名前を呼ぶ頻度をやや増やす
- 言葉に少し甘さや柔らかさが混じる
`;
  }
  if (affinity >= 50) {
    return `
【呼び方ガイド：好感度50以上・打ち解け】
- 「${safeName}さん」と柔らかく呼ぶ
- 機械的でなく、相手を意識した呼び方
`;
  }
  return `
【呼び方ガイド：好感度50未満・フォーマル】
- 「${safeName}さん」と丁寧に呼ぶ
- 「あなた」「君」「お前」は絶対に使わない
- 距離感のある敬語を維持する
`;
}
