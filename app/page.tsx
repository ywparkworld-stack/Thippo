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
        {/* 貸与 */}
        <Link href="/register/lend" className="group bg-white rounded-3xl border-2 border-gray-100 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-100 transition-all duration-200 p-10 flex flex-col items-center text-center">
          <span className="text-6xl mb-5">🏢</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">貸与したい</h2>
          <p className="text-sm text-gray-500 leading-relaxed">空き部屋・会議室・設備を<br />時間単位で貸し出す</p>
          <span className="mt-6 inline-block bg-indigo-600 text-white text-sm px-5 py-2 rounded-full font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            登録して掲載する →
          </span>
        </Link>

        {/* 拝借 */}
        <Link href="/register/use" className="group bg-white rounded-3xl border-2 border-gray-100 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-100 transition-all duration-200 p-10 flex flex-col items-center text-center">
          <span className="text-6xl mb-5">🔍</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">拝借したい</h2>
          <p className="text-sm text-gray-500 leading-relaxed">必要な時間だけ<br />スペース・設備を借りる</p>
          <span className="mt-6 inline-block bg-purple-600 text-white text-sm px-5 py-2 rounded-full font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            登録してスペースを探す →
          </span>
        </Link>
      </div>

      <p className="mt-10 text-sm text-gray-400">
        すでにアカウントをお持ちの方は
        <Link href="/login" className="text-indigo-600 font-semibold hover:underline ml-1">ログイン</Link>
      </p>
    </div>
  );
}
