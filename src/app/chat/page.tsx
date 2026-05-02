import { redirect } from "next/navigation";
import { characterList } from "@/characters";

/** `/chat` 単体で開かれたときは先頭キャラのチャットへ */
export default function ChatIndexPage() {
  const first = characterList[0];
  if (first) {
    redirect(`/chat/${encodeURIComponent(first.id)}`);
  }
  redirect("/");
}
