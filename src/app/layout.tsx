import type { Metadata, Viewport } from "next";
import "./globals.css";
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
    <html lang="ja">
      <body className="min-h-dvh antialiased">
        <PlayerNameProvider>{children}</PlayerNameProvider>
      </body>
    </html>
  );
}
