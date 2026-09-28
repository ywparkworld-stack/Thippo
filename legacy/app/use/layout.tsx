import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thippo - 本日の空きスペースを借りる",
  description: "企業の空き部屋・会議室・設備を時間単位で借りられる。当日の空きスペースをすぐに予約。",
};

export default function UseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="fixed top-0 w-full bg-white border-b border-purple-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/use" className="text-xl font-bold text-purple-600 tracking-tight">
              Thippo
            </Link>
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-semibold hidden sm:inline">
              拝借様向け
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <Link href="/use" className="hover:text-purple-600 transition-colors">本日の空き</Link>
            <Link href="/use#how" className="hover:text-purple-600 transition-colors">使い方</Link>
            <Link href="/use#spaces" className="hover:text-purple-600 transition-colors">スペース一覧</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/use/login" className="text-sm text-gray-600 hover:text-purple-600 transition-colors">
              ログイン
            </Link>
            <Link
              href="/use/register"
              className="text-sm bg-purple-600 text-white px-4 py-2 rounded-full hover:bg-purple-700 transition-colors font-semibold"
            >
              無料登録
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
              <p className="text-xs text-purple-400 mb-2">拝借様向けプラットフォーム</p>
              <p className="text-sm max-w-xs">企業の空きスペース・設備を時間単位で借りられる。当日すぐ利用開始。</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="text-white font-semibold mb-3">サービス</p>
                <ul className="space-y-2">
                  <li><Link href="/use" className="hover:text-white transition-colors">本日の空きスペース</Link></li>
                  <li><Link href="/use/register" className="hover:text-white transition-colors">無料登録</Link></li>
                  <li><Link href="/use#how" className="hover:text-white transition-colors">使い方</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-white font-semibold mb-3">サポート</p>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-white transition-colors">ヘルプセンター</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">お問い合わせ</a></li>
                  <li><Link href="/lend" className="hover:text-white transition-colors">貸与様向けサイト</Link></li>
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
