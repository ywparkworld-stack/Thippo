import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 font-[family-name:var(--font-geist-sans)] bg-gray-50">
      <div className="text-center mb-14">
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight mb-3">Thippo</h1>
        <p className="text-gray-500 text-lg">企業の空きスペース・設備をシェアするプラットフォーム</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 w-full max-w-2xl">
        <Link
          href="/lend"
          className="group bg-white rounded-3xl border-2 border-gray-100 hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-300 p-12 flex flex-col items-center text-center"
        >
          <span className="text-7xl mb-6">🏢</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">貸与したい</h2>
          <p className="text-sm text-gray-400 mb-6">スペース・設備を貸し出して収益化</p>
          <span className="inline-block bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-full font-semibold group-hover:bg-indigo-700 transition-colors">
            貸与様向けサイトへ →
          </span>
        </Link>

        <Link
          href="/use"
          className="group bg-white rounded-3xl border-2 border-gray-100 hover:border-purple-400 hover:shadow-2xl hover:shadow-purple-100 transition-all duration-300 p-12 flex flex-col items-center text-center"
        >
          <span className="text-7xl mb-6">🔍</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-1 group-hover:text-purple-600 transition-colors">拝借したい</h2>
          <p className="text-sm text-gray-400 mb-6">必要な時間だけスペース・設備を借りる</p>
          <span className="inline-block bg-purple-600 text-white text-sm px-6 py-2.5 rounded-full font-semibold group-hover:bg-purple-700 transition-colors">
            拝借様向けサイトへ →
          </span>
        </Link>
      </div>

      <p className="mt-12 text-xs text-gray-400">© 2025 Thippo. All rights reserved.</p>
    </div>
  );
}
