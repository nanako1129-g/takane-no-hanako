"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getCharacter } from "@/characters";
import {
  clearCachedAnalysis,
  conversationFingerprint,
  readCachedAnalysis,
  writeCachedAnalysis,
} from "@/lib/analysisCache";
import { messageContentForGemini } from "@/lib/stamps";
import type { AnalysisAxes, AnalysisResult, Message } from "@/types";

const MESSAGES_PREFIX = "messages_";

const AXIS_LABELS: { key: keyof AnalysisAxes; label: string; hint: string }[] = [
  { key: "listening", label: "聴く力", hint: "受け止めて深掘りできる力" },
  { key: "expressing", label: "伝える力", hint: "意見・経験を言語化する力" },
  { key: "acting", label: "動く力", hint: "提案や次の一歩を出す力" },
  { key: "protecting", label: "守る力", hint: "相手の境界を尊重する力" },
  { key: "perceiving", label: "察する力", hint: "相手の内心や状況を読む力" },
];

function readMessages(charId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${MESSAGES_PREFIX}${charId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildConversation(messages: Message[]) {
  return messages
    .filter((m) => messageContentForGemini(m).trim().length > 0)
    .map((m) => ({
      role: m.role,
      content: messageContentForGemini(m),
    }));
}

export default function AnalysisPage({
  params,
}: {
  params: { charId: string };
}) {
  const character = getCharacter(params.charId);
  if (!character) notFound();

  const [hydrated, setHydrated] = useState(false);
  const [loadingApi, setLoadingApi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const [conversationStale, setConversationStale] = useState(false);

  /** マウント時：localStorage のキャッシュだけ読む（APIは呼ばない） */
  useEffect(() => {
    const messages = readMessages(character.id);
    const fp = conversationFingerprint(messages);
    const conv = buildConversation(messages);

    if (conv.length === 0) {
      clearCachedAnalysis(character.id);
      setResult(null);
      setHasHistory(false);
      setConversationStale(false);
      setHydrated(true);
      return;
    }

    setHasHistory(true);

    const cached = readCachedAnalysis(character.id);

    if (cached) {
      setResult(cached.result);
      setConversationStale(fp !== cached.fingerprint);
    } else {
      setResult(null);
      setConversationStale(false);
    }

    setHydrated(true);
  }, [character.id]);

  /** Gemini API を実行してキャッシュにも保存する */
  const runAnalyzeViaApi = useCallback(async () => {
    const messages = readMessages(character.id);
    const conversation = buildConversation(messages);
    setHasHistory(conversation.length > 0);
    setError(null);

    if (conversation.length === 0) {
      setResult(null);
      clearCachedAnalysis(character.id);
      setError(
        "分析できる会話履歴がありません。先にチャットしてみてください。"
      );
      setConversationStale(false);
      return;
    }

    setLoadingApi(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          charId: character.id,
          messages: conversation,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as AnalysisResult;
      const fpAfter = conversationFingerprint(messages);

      setResult(data);
      setConversationStale(false);
      writeCachedAnalysis(character.id, {
        result: data,
        fingerprint: fpAfter,
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "分析に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setLoadingApi(false);
    }
  }, [character.id]);

  const emptyButHasConversation =
    hydrated &&
    !result &&
    !error &&
    hasHistory &&
    !loadingApi;
  const noConversationPlaceholder =
    hydrated &&
    !hasHistory &&
    !loadingApi &&
    !error &&
    !result;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 bg-rose-50/30 px-5 py-6">
      <header className="flex items-center gap-3">
        <Link
          href={`/chat/${character.id}`}
          className="rounded-full px-2 py-1 text-sm text-slate-500 transition hover:bg-rose-50 hover:text-rose-500"
          aria-label="チャットに戻る"
        >
          ‹
        </Link>
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-rose-100 to-pink-200 ring-1 ring-rose-100">
          <Image
            src={character.images.happy}
            alt={character.name}
            fill
            sizes="40px"
            className="object-cover object-top"
          />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
            Conversation Analysis
          </p>
          <h1 className="text-lg font-bold text-slate-800">
            {character.name} との会話 振り返り
          </h1>
        </div>
      </header>

      {!hydrated && (
        <div className="flex items-center justify-center rounded-2xl border border-rose-100 bg-white/80 px-6 py-10 text-sm text-slate-500">
          <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-rose-300 border-t-transparent" />
          準備しています…
        </div>
      )}

      {hydrated && loadingApi && !result && (
        <div className="flex items-center justify-center rounded-2xl border border-rose-100 bg-white/80 px-6 py-12 text-sm text-slate-500">
          <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-rose-300 border-t-transparent" />
          分析中… Gemini に送信中です
        </div>
      )}

      {hydrated && loadingApi && result && (
        <div className="rounded-xl border border-rose-200 bg-white/95 px-3 py-2 text-center text-xs text-rose-600 shadow-sm">
          <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full align-middle border-2 border-rose-300 border-t-transparent" />
          再分析中です…※完了まで画面上の数字はまだ更新されません。
        </div>
      )}

      {hydrated && conversationStale && result && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">
          チャットが前回この分析より更新されています。このまま読むだけではOKです。「もう一度振り返る」で最新ログを送ってください。
        </div>
      )}

      {hydrated && !loadingApi && error && (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          <p>{error}</p>
          <div className="flex flex-wrap gap-2">
            {hasHistory && (
              <button
                type="button"
                onClick={() => void runAnalyzeViaApi()}
                className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
              >
                再度試す
              </button>
            )}
            <Link
              href={`/chat/${character.id}`}
              className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-white"
            >
              チャットに戻る
            </Link>
          </div>
        </div>
      )}

      {hydrated && emptyButHasConversation && (
        <div className="space-y-5 rounded-2xl border border-rose-100 bg-white/90 px-5 py-10 text-center shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            まだ振り返りを実行していません（この画面への再訪では API
            は呼びません）。
          </p>
          <button
            type="button"
            onClick={() => void runAnalyzeViaApi()}
            disabled={loadingApi}
            className="w-full rounded-full bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            この会話で振り返る（Gemini で分析）
          </button>
          <Link
            href={`/chat/${character.id}`}
            className="inline-block text-sm font-medium text-rose-600 underline-offset-4 hover:underline"
          >
            ← チャットに戻る
          </Link>
        </div>
      )}

      {hydrated && noConversationPlaceholder && (
        <div className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-8 text-center text-sm leading-relaxed text-slate-600">
          会話がまだありません。
          <br />
          <Link
            href={`/chat/${character.id}`}
            className="mt-3 inline-block font-medium text-rose-600 underline-offset-4 hover:underline"
          >
            チャットへ
          </Link>
        </div>
      )}

      {hydrated && result && (
        <>
          <section
            className={`rounded-2xl border border-rose-100 bg-white/90 px-5 py-5 text-center shadow-sm ${loadingApi ? "opacity-60" : ""}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              総合スコア
            </p>
            <p className="mt-1 font-mono text-5xl font-bold text-rose-500">
              {result.totalScore}
              <span className="ml-1 text-base font-medium text-slate-400">
                / 100
              </span>
            </p>
            {result.comment && (
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {result.comment}
              </p>
            )}
          </section>

          <section
            className={`space-y-3 rounded-2xl border border-rose-100 bg-white/90 px-5 py-5 shadow-sm ${loadingApi ? "opacity-60" : ""}`}
          >
            <h2 className="text-sm font-semibold text-slate-700">
              5軸スコア
            </h2>
            <ul className="space-y-3">
              {AXIS_LABELS.map(({ key, label, hint }) => {
                const value = result.axes[key];
                return (
                  <li key={key} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-slate-700">{label}</span>
                      <span className="font-mono text-xs text-slate-500">
                        {value} / 100
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-rose-50">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pink-300 to-rose-500 transition-[width] duration-700 ease-out"
                        style={{ width: `${value}%` }}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={value}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">{hint}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            className={`grid gap-3 sm:grid-cols-2 ${loadingApi ? "opacity-60" : ""}`}
          >
            <div className="rounded-2xl border border-rose-100 bg-white/90 p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-500">
                良かった点
              </h3>
              {result.goodPoints.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-700">
                  {result.goodPoints.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-400">該当なし</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                改善点
              </h3>
              {result.improvements.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-700">
                  {result.improvements.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-400">該当なし</p>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={loadingApi}
              onClick={() => void runAnalyzeViaApi()}
              className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              もう一度振り返る（API）
            </button>
            <Link
              href={`/chat/${character.id}`}
              className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
            >
              会話を続ける
            </Link>
          </div>
          <p className="text-center text-[10px] leading-relaxed text-slate-400">
            結果はブラウザにキャッシュされています。この画面へ戻ると自動では再送信されません。
          </p>
        </>
      )}
    </main>
  );
}
