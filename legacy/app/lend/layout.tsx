import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thippo for Owners - 空きスペースを貸し出す",
  description: "企業の空き部屋・会議室・設備を時間単位で貸し出して収益化。今日の空き時間をすぐに掲載できます。",
};

export default function LendLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="fixed top-0 w-full bg-white border-b border-indigo-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/lend" className="text-xl font-bold text-indigo-600 tracking-tight">
              Thippo
            </Link>
            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-semibold hidden sm:inline">
              貸与様向け
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <Link href="/lend#how" className="hover:text-indigo-600 transition-colors">使い方</Link>
            <Link href="/lend#features" className="hover:text-indigo-600 transition-colors">機能</Link>
            <Link href="/lend#faq" className="hover:text-indigo-600 transition-colors">よくある質問</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/lend/login" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">
              ログイン
            </Link>
            <Link
              href="/lend/register"
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors font-semibold"
            >
              無料で掲載する
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16">{children}</main>

      <footer className="bg-gray-900 text-gray-400 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
            <div>
              <p className="text-white font-bold text-xl mb-1">Thippo</p>
              <p className="text-xs text-indigo-400 mb-2">貸与様向けプラットフォーム</p>
              <p className="text-sm max-w-xs">企業の空きスペース・設備を時間単位で貸し出して収益化。</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="text-white font-semibold mb-3">サービス</p>
                <ul className="space-y-2">
                  <li><Link href="/lend/register" className="hover:text-white transition-colors">無料で掲載する</Link></li>
                  <li><Link href="/lend#how" className="hover:text-white transition-colors">使い方</Link></li>
                  <li><Link href="/lend#features" className="hover:text-white transition-colors">機能一覧</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-white font-semibold mb-3">サポート</p>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-white transition-colors">ヘルプセンター</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">お問い合わせ</a></li>
                  <li><Link href="/use" className="hover:text-white transition-colors">拝借様向けサイト</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-white font-semibold mb-3">法的情報</p>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-white transition-colors">利用規約</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">プライバシーポリシー</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">特定商取引法</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-sm text-center">
            © 2025 Thippo. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
