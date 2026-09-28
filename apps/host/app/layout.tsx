import type { Metadata } from "next";
import { PageShell } from "@thippo/ui";
import { SiteNav } from "./site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "thippo 貸出主センター",
  description: "thippo に掲載するスペースと予約を管理する",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">
        <PageShell siteName="thippo 貸出主センター" nav={<SiteNav />}>
          {children}
        </PageShell>
      </body>
    </html>
  );
}
