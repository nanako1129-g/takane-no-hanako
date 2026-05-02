"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  message: string | null;
  onDismiss: () => void;
};

export function UnlockToast({ message, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      onDismissRef.current();
    }, 3000);
    return () => clearTimeout(t);
  }, [message]);

  if (!message || !visible) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-rose-500 px-5 py-3 text-sm text-white shadow-lg animate-toast-slide"
    >
      {message}
    </div>
  );
}
