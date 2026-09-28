import Link from "next/link";

export default function LendPage() {
  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600 tracking-tight">Thippo</Link>
          <div className="flex items-center gap-4">
            <Link href="/use" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors hidden sm:block">使用したい方はこちら →</Link>
            <a href="#" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors">無料で掲載する</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-br from-indigo-50 via-white to-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full mb-6 animate-pulse">● 今日から貸し出し開始できます</span>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
            今日の空き時間を、<br />
            <span className="text-indigo-600">今日の収益に。</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            登録から掲載まで最短15分。当日の空き時間をそのまま貸し出せます。<br />
            遊休スペースがタイムーのように即日マッチングされます。
          </p>
          <a href="#" className="bg-indigo-600 text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
            無料でスペースを掲載する
          </a>
          <p className="mt-4 text-sm text-gray-400">初期費用・登録料 完全無料。成約時のみ手数料。</p>
        </div>

        {/* Stats */}
        <div className="max-w-3xl mx-auto mt-16 grid grid-cols-3 gap-8 text-center">
          {[
            { value: "最短15分", label: "掲載完了まで" },
            { value: "当日", label: "から貸し出し可能" },
            { value: "月末", label: "に自動振込" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-indigo-600">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">今日の空き時間をすぐに貸し出す</h2>
          <p className="text-center text-gray-500 mb-16">タイミーのように、その日の空き時間を即日公開できます</p>
          <div className="space-y-6">
            {[
              { step: "01", title: "スペース情報を登録", desc: "写真・設備・料金を入力するだけ。最短15分で今日の空き枠を公開できます。", badge: "最短15分" },
              { step: "02", title: "今日の空き時間を設定", desc: "カレンダーで「今日の何時〜何時が空いている」を設定。すぐに検索画面に表示されます。", badge: "即日公開" },
              { step: "03", title: "予約リクエストを承認", desc: "利用希望者から通知が届いたら、ワンタップで承認。", badge: "即時通知" },
              { step: "04", title: "収益を受け取る", desc: "利用終了後に自動精算。月末に銀行口座へ振込。", badge: "自動精算" },
            ].map((s) => (
              <div key={s.step} className="flex gap-6 items-start p-6 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all">
                <span className="text-3xl font-bold text-indigo-200 w-12 shrink-0">{s.step}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-lg font-semibold text-gray-900">{s.title}</p>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{s.badge}</span>
                  </div>
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
              { icon: "📅", title: "柔軟な時間設定", desc: "当日の空き時間を好きな単位で設定。1時間から貸し出し可能。" },
              { icon: "📊", title: "稼働率ダッシュボード", desc: "予約状況・収益をリアルタイムで確認できます。" },
              { icon: "🔒", title: "利用者の事前審査", desc: "法人・個人事業主向けの審査で安心して貸し出せます。" },
              { icon: "💳", title: "自動決済・未払いゼロ", desc: "料金回収は全自動。未払いリスクゼロで安心です。" },
              { icon: "💬", title: "メッセージ機能", desc: "事前確認・当日連絡もプラットフォーム内で完結。" },
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
          <h2 className="text-3xl font-bold text-white mb-4">今日の空き時間、今日から収益に</h2>
          <p className="text-indigo-200 mb-8">登録から掲載まで完全無料。今すぐ始めましょう。</p>
          <a href="#" className="bg-white text-indigo-600 px-8 py-4 rounded-full text-base font-semibold hover:bg-indigo-50 transition-colors">
            無料でスペースを掲載する
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
