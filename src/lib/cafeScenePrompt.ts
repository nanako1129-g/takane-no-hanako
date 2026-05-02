/**
 * CharacterConfig.cafeSceneSystemPrompt に含められる動的フィールド。
 * テンプレ内はリテラルとして `${turnsInScene}` / `${maxTurns}` を書く。
 */
export function interpolateCafeSceneSystemPrompt(
  template: string,
  turnsInScene: number,
  maxTurns: number
): string {
  return template
    .replace(/\$\{turnsInScene\}/g, String(turnsInScene))
    .replace(/\$\{maxTurns\}/g, String(maxTurns));
}
