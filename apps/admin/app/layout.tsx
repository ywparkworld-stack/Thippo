import type { Metadata } from "next";
import { PageShell } from "@thippo/ui";
import { SiteNav } from "./site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "thippo 運営管理",
  description: "thippo 運営管理",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">
        <PageShell siteName="thippo 運営管理" nav={<SiteNav />}>
          {children}
        </PageShell>
      </body>
    </html>
  );
}
