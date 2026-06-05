import Link from "next/link";

export default function LendPage() {
  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600 tracking-tight">Thippo</Link>
          <Link href="/use" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">使用したい方はこちら →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-br from-indigo-50 via-white to-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">スペースオーナー向け</span>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
            空きスペースを、<br />
            <span className="text-indigo-600">収益に変える。</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            使っていない部屋・会議室・設備を時間単位で貸し出し。<br />
            遊休資産がそのまま毎月の収益になります。
          </p>
          <a href="#" className="bg-indigo-600 text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
            無料でスペースを掲載する
          </a>
          <p className="mt-4 text-sm text-gray-400">初期費用・登録料 完全無料。成約時のみ手数料。</p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-16">最短15分で掲載完了</h2>
          <div className="space-y-8">
            {[
              { step: "01", title: "スペース情報を登録", desc: "写真・設備・利用可能時間帯・料金を入力するだけ。難しい設定は一切不要。" },
              { step: "02", title: "予約リクエストを承認", desc: "利用希望者から通知が届いたら、プロフィールを確認して承認するだけ。" },
              { step: "03", title: "収益を受け取る", desc: "利用終了後に自動精算。月末にまとめて銀行口座へ振込。" },
            ].map((s) => (
              <div key={s.step} className="flex gap-6 items-start p-6 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all">
                <span className="text-3xl font-bold text-indigo-200 w-12 shrink-0">{s.step}</span>
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-1">{s.title}</p>
                  <p className="text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-indigo-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-16">オーナーに嬉しい機能</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "📊", title: "稼働率ダッシュボード", desc: "スペースの予約状況・収益をリアルタイムで確認できます。" },
              { icon: "🔒", title: "利用者の事前審査", desc: "法人・個人事業主向けの厳格な審査で安心して貸し出せます。" },
              { icon: "💳", title: "自動決済・請求書対応", desc: "料金回収は全自動。未払いリスクゼロで安心です。" },
              { icon: "📅", title: "カレンダー管理", desc: "貸し出し可能な時間帯を自由に設定・変更できます。" },
              { icon: "💬", title: "メッセージ機能", desc: "利用者との事前確認もプラットフォーム内で完結。" },
              { icon: "🛡️", title: "損害補償制度", desc: "万が一のトラブルにも補償制度で対応します。" },
            ].map((f) => (
              <div key={f.title} className="bg-white p-6 rounded-2xl border border-gray-100">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="font-semibold text-gray-900 mt-4 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-indigo-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">今すぐ無料で始めましょう</h2>
          <p className="text-indigo-200 mb-8">登録から掲載まで完全無料。いつでも退会できます。</p>
          <a href="#" className="bg-white text-indigo-600 px-8 py-4 rounded-full text-base font-semibold hover:bg-indigo-50 transition-colors">
            スペースを無料掲載する
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-6 text-center text-sm">
        <Link href="/" className="text-white font-bold">Thippo</Link>
        <p className="mt-2">© 2025 Thippo. All rights reserved.</p>
      </footer>
    </div>
  );
}
