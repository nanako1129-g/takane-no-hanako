import { hanasaki, pickHanasakiImage } from "./hanasaki";
import { imageSrcForAffinity } from "@/lib/characterPortrait";
import type { CharacterConfig } from "@/types";

export { hanasaki, pickHanasakiImage } from "./hanasaki";

export const characters = {
  hanasaki,
};

export type CharacterId = keyof typeof characters;

/** ホーム等で一覧表示するときはこの配列から map すること */
export const characterList = Object.values(characters).map((c) => ({
  ...c,
  route: `/chat/${encodeURIComponent(c.id)}`,
}));

/** 一覧・詳細での取得 */
export function getCharacter(id?: string): CharacterConfig | undefined {
  if (!id || !(id in characters)) return undefined;
  return characters[id as CharacterId];
}

/** メッセージリスト内のユーザー横アイコンなど小さめ表示用のパス選択 */
export function pickCharacterPortrait(
  character: CharacterConfig | undefined | null,
  affinity: number
): string | null {
  if (!character?.images) return null;
  if (character.id === hanasaki.id) {
    return pickHanasakiImage(affinity);
  }
  return imageSrcForAffinity(character.images, affinity);
}
