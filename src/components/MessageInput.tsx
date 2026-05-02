"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

interface MessageInputProps {
  onSubmit: (text: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSubmit,
  disabled,
  placeholder = "メッセージを入力…",
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await onSubmit(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="inline-flex items-center justify-center rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {disabled ? "考え中…" : "送る"}
      </button>
    </form>
  );
}
