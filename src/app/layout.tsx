import type { Metadata, Viewport } from "next";
import { Shippori_Mincho } from "next/font/google";
import "./globals.css";

const shipporiMincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-shippori",
  display: "swap",
});
import {
  BgmPreferenceProvider,
} from "@/components/BgmPreferenceProvider";
import { ConditionalRootBgm } from "@/components/ConditionalRootBgm";
import { PlayerNameProvider } from "@/components/PlayerNameProvider";

export const metadata: Metadata = {
  title: "高嶺の花子さん",
  description:
    "高嶺の花キャラとチャット。表面の返答とは別に「内心」が見える、ちょっとドキドキするコミュニケーションアプリ。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fff7f4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={shipporiMincho.variable}>
      <body className="min-h-dvh antialiased">
        <PlayerNameProvider>
          <BgmPreferenceProvider>
            <ConditionalRootBgm />
            {children}
          </BgmPreferenceProvider>
        </PlayerNameProvider>
      </body>
    </html>
  );
}
