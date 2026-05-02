"use client";

import { usePathname } from "next/navigation";
import { BgmFloatingToggle } from "@/components/BgmPreferenceProvider";

/** `/chat/*` ではヘッダー内に BGM ボタンがあるため、固定配置のトグルは出さない */
export function ConditionalRootBgm() {
  const pathname = usePathname();
  if (pathname?.startsWith("/chat/")) return null;
  return <BgmFloatingToggle />;
}
