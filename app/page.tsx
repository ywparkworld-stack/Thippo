import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center px-6 font-[family-name:var(--font-geist-sans)]">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-indigo-600 tracking-tight mb-3">Thippo</h1>
        <p className="text-gray-500 text-lg">企業の空きスペース・設備をシェアするプラットフォーム</p>
      </div>

      <p className="text-gray-700 font-semibold text-xl mb-8">あなたはどちらですか？</p>

      <div className="grid sm:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* 貸出 */}
        <Link href="/lend" className="group bg-white rounded-3xl border-2 border-gray-100 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-100 transition-all duration-200 p-10 flex flex-col items-center text-center">
          <span className="text-6xl mb-5">🏢</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">貸出したい</h2>
          <p className="text-sm text-gray-500 leading-relaxed">空き部屋・会議室・設備を<br />時間単位で貸し出す</p>
          <span className="mt-6 text-sm text-indigo-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">詳しく見る →</span>
        </Link>

        {/* 使用 */}
        <Link href="/use" className="group bg-white rounded-3xl border-2 border-gray-100 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-100 transition-all duration-200 p-10 flex flex-col items-center text-center">
          <span className="text-6xl mb-5">🔍</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">使用したい</h2>
          <p className="text-sm text-gray-500 leading-relaxed">必要な時間だけ<br />スペース・設備を借りる</p>
          <span className="mt-6 text-sm text-purple-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">詳しく見る →</span>
        </Link>
      </div>

      <p className="mt-12 text-xs text-gray-400">初期費用・登録料 完全無料</p>
    </div>
  );
}
