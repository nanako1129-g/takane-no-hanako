"use client";

import { useEffect, useState } from "react";
import { sanitizeUserName, USER_NAME_MAX_LEN } from "@/lib/userProfile";

type Props = {
  isOpen: boolean;
  initialName?: string;
  onSubmit: (name: string) => void;
  onCancel?: () => void; // 渡さなければキャンセル不可
};

export function UserNameModal({
  isOpen,
  initialName = "",
  onSubmit,
  onCancel,
}: Props) {
  const [input, setInput] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setInput(initialName);
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const clean = sanitizeUserName(input);
    if (!clean) {
      setError("お名前を入力してください（1〜12文字、記号のみは不可）");
      return;
    }
    setError(null);
    onSubmit(clean);
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm animate-fade-portrait rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-bold text-rose-600">
          お名前を教えてください
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          花咲さんが、あなたをこの名前で呼びます。
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value.slice(0, USER_NAME_MAX_LEN));
            setError(null);
          }}
          maxLength={USER_NAME_MAX_LEN}
          placeholder="例：メイナ"
          className="w-full rounded-lg border border-rose-200 px-4 py-3 text-base focus:border-rose-500 focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <p className="mt-2 text-[10px] text-gray-400">
          ※ 後からヘッダーの ⚙️ ボタンで変更できます。
        </p>
        <div className="mt-5 flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-full border border-gray-300 py-2 text-gray-600 transition hover:bg-gray-50"
            >
              キャンセル
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 rounded-full bg-rose-500 py-2 text-white transition hover:bg-rose-600"
          >
            決定
          </button>
        </div>
      </div>
    </div>
  );
}
