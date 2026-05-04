"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { InnerVoiceBubble } from "./InnerVoiceBubble";
import { formatChatTime } from "@/lib/date";
import { getStamp } from "@/lib/stamps";
import type { Message } from "@/types";

interface ChatBubbleProps {
  message: Message;
  characterName?: string;
  /** 相手（assistant）メッセージ左に表示する顔アイコン（LINE風） */
  characterAvatarSrc?: string;
  characterAvatarAlt?: string;
  proposalActions?: {
    onAccept: () => void;
    onDecline: () => void;
  };
}

export function ChatBubble({
  message,
  characterName,
  characterAvatarSrc,
  characterAvatarAlt = "相手",
  proposalActions,
}: ChatBubbleProps) {
  const [open, setOpen] = useState(false);
  const isUser = message.role === "user";

  const hasInner = !isUser && Boolean(message.inner);
  const timeLabel = formatChatTime(message.createdAt);
  const stamp = isUser ? getStamp(message.stampId) : undefined;

  if (isUser) {
    return (
      <div className="flex w-full flex-col items-end">
        <div className="flex max-w-[90%] items-end gap-2">
          <span className="shrink-0 pb-2 font-mono text-[11px] leading-none tracking-tight text-slate-400">
            {timeLabel}
          </span>
          <div className="flex min-w-0 flex-col items-end">
            {stamp ? (
              <div className="flex flex-col items-end gap-2">
                <div className="inline-flex rounded-3xl rounded-br-md bg-gradient-to-br from-teal-50 to-teal-100/95 p-[10px] shadow-md ring-[2.5px] ring-teal-600/95">
                  <span
                    className="block text-[clamp(3.75rem,18vw,5rem)] leading-none tracking-tight"
                    role="img"
                    aria-label={stamp.alt}
                  >
                    {stamp.emoji}
                  </span>
                </div>
                {message.content.trim().length > 0 && (
                  <Bubble role="user">{message.content}</Bubble>
                )}
              </div>
            ) : (
              <Bubble role="user">{message.content}</Bubble>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-start">
      {/* 名前は吹き出しの上（LINEの相手名表示）— 左はアバターぶんだけ空ける */}
      {characterName && (
        <div className="mb-1 flex w-full items-center gap-2 pl-[2.25rem]">
          <span className="text-[11px] font-medium text-slate-500">
            {characterName}
          </span>
        </div>
      )}

      <div className="flex w-full max-w-full items-end gap-2">
        {/* 吹き出し行の左に顔アイコン */}
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-200/80">
          {characterAvatarSrc ? (
            <Image
              src={characterAvatarSrc}
              alt={characterAvatarAlt}
              fill
              sizes="36px"
              className="object-cover object-top"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #fda4af, #fb7185)",
              }}
            >
              AI
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-start">
          {/* 吹き出しと時刻だけ横並び（内心ボタンは下段へ） */}
          <div className="flex w-full items-end gap-2">
            <div className="min-w-0 max-w-[min(100%,calc(100%-4rem))] flex-1">
              <Bubble role={message.role} preserveLines={Boolean(message.proposalChoices)}>
                {message.content}
              </Bubble>
            </div>
            <span className="shrink-0 self-end pb-[3px] font-mono text-[11px] leading-none tracking-tight text-slate-400">
              {timeLabel}
            </span>
          </div>

          {message.proposalChoices && proposalActions ? (
            <div className="mt-2 flex w-full flex-wrap gap-2 pl-0 md:max-w-[min(100%,420px)]">
              <button
                type="button"
                onClick={proposalActions.onAccept}
                className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-rose-600 hover:to-pink-600"
              >
                💍 はい、私も・・・
              </button>
              <button
                type="button"
                onClick={proposalActions.onDecline}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50"
              >
                もう少し考える
              </button>
            </div>
          ) : null}

          {hasInner && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className={`mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition hover:border-rose-200 hover:text-rose-500 ${
                message.autoKind === "bar_silence_inner"
                  ? "border-rose-300/80 bg-rose-50/90 text-rose-900"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <span aria-hidden>💭</span>
              <span>{open ? "内心を隠す" : "内心を見る"}</span>
            </button>
          )}

          {hasInner && open && (
            <InnerVoiceBubble
              inner={message.inner!}
              affinityChange={message.affinityChange}
              variant={
                message.autoKind === "bar_silence_inner"
                  ? "silenceReveal"
                  : "default"
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  preserveLines,
  children,
}: {
  role: Message["role"];
  preserveLines?: boolean;
  children: ReactNode;
}) {
  if (role === "user") {
    return (
      <div className="rounded-2xl rounded-br-md bg-rose-500 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
        {children}
      </div>
    );
  }
  return (
    <div
      className={`rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm${preserveLines ? " whitespace-pre-wrap" : ""}`}
    >
      {children}
    </div>
  );
}
