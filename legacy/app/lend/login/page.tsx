import Link from "next/link";

export default function LendLoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">ログイン</h1>
          <p className="text-gray-500 text-sm">貸与様向けアカウントにログイン</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">メールアドレス</label>
            <input type="email" placeholder="taro@company.com" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-semibold text-gray-700">パスワード</label>
              <a href="#" className="text-xs text-indigo-600 hover:underline">パスワードを忘れた方</a>
            </div>
            <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
          </div>
          <Link href="/lend" className="block w-full bg-indigo-600 text-white text-center py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
            ログイン
          </Link>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-4 text-xs text-gray-400">または</span></div>
          </div>
          <div className="space-y-3">
            {[{ label: "Googleで続ける", icon: "🔵" }, { label: "Appleで続ける", icon: "⚫" }].map((s) => (
              <button key={s.label} className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          アカウントをお持ちでない方は
          <Link href="/lend/register" className="text-indigo-600 font-semibold hover:underline ml-1">新規登録</Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-3">
          <Link href="/use/login" className="hover:text-gray-600">拝借様向けログインはこちら</Link>
        </p>
      </div>
    </div>
  );
}
