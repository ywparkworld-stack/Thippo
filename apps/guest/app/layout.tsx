import type { Metadata } from "next";
import { PageShell } from "@thippo/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "thippo｜空きスペースを30分から予約",
  description: "企業の空き会議室・空き部屋を30分単位で予約できるマーケットプレイス",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">
        <PageShell siteName="thippo">{children}</PageShell>
      </body>
    </html>
  );
}
