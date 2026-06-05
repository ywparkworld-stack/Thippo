import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      <div className="min-h-screen grid md:grid-cols-2">
        {/* Left: Visual */}
        <div className="hidden md:flex flex-col justify-between bg-indigo-600 p-12 text-white">
          <span className="text-2xl font-bold tracking-tight">Thippo</span>
          <div>
            <h2 className="text-4xl font-bold leading-tight mb-4">
              企業の空きスペース・設備を、必要な時間だけ。
            </h2>
            <p className="text-indigo-200 text-lg leading-relaxed">
              当日から貸し出し・利用開始。遊休資産を即日マッチング。
            </p>
            <div className="mt-10 space-y-4">
              {[
                { icon: "🏢", text: "会議室・セミナールーム・スタジオなど多数" },
                { icon: "⚡", text: "当日の空き時間を即時予約" },
                { icon: "🔒", text: "本人確認済みユーザーのみ利用可能" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 text-indigo-100">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-indigo-300 text-xs">© 2025 Thippo. All rights reserved.</p>
        </div>

        {/* Right: Auth */}
        <div className="flex flex-col justify-center px-8 py-16 md:px-16 bg-white">
          {/* Mobile logo */}
          <span className="text-2xl font-bold text-indigo-600 mb-10 md:hidden">Thippo</span>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">はじめましょう</h1>
          <p className="text-gray-500 mb-10">登録・ログインしてスペースを探す</p>

          {/* Register CTA */}
          <Link
            href="/register"
            className="block w-full bg-indigo-600 text-white text-center py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors mb-3 shadow-lg shadow-indigo-100"
          >
            新規登録（無料）
          </Link>
          <Link
            href="/login"
            className="block w-full border-2 border-gray-200 text-gray-700 text-center py-4 rounded-xl font-semibold hover:border-indigo-400 hover:text-indigo-600 transition-colors mb-8"
          >
            ログイン
          </Link>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-xs text-gray-400">または</span>
            </div>
          </div>

          {/* Social login */}
          <div className="space-y-3 mb-10">
            {[
              { label: "Googleで続ける", icon: "🔵" },
              { label: "Appleで続ける", icon: "⚫" },
            ].map((s) => (
              <button
                key={s.label}
                className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 leading-relaxed">
            登録することで
            <a href="#" className="text-indigo-600 hover:underline mx-1">利用規約</a>
            および
            <a href="#" className="text-indigo-600 hover:underline mx-1">プライバシーポリシー</a>
            に同意したものとみなされます
          </p>
        </div>
      </div>
    </div>
  );
}
