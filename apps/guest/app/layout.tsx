import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@thippo/ui";
import { SiteNav } from "./site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "thippo｜空きスペースを30分から予約",
  description: "企業の空き会議室・空き部屋を30分単位で予約できるマーケットプレイス",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">
        <PageShell siteName="thippo" nav={<SiteNav />} footer={<FooterLinks />}>
          {children}
        </PageShell>
      </body>
    </html>
  );
}

const FOOTER_LINKS: [string, string][] = [
  ["/terms", "利用規約"],
  ["/privacy", "プライバシーポリシー"],
  ["/tokushoho", "特定商取引法に基づく表記"],
  ["/cancel-policy", "キャンセル規定"],
  ["/faq", "よくある質問"],
  ["/contact", "お問い合わせ"],
  ["/hosts", "スペースを掲載する"],
];

function FooterLinks() {
  return (
    <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
      {FOOTER_LINKS.map(([href, label]) => (
        <Link key={href} href={href} className="hover:underline">
          {label}
        </Link>
      ))}
    </nav>
  );
}
