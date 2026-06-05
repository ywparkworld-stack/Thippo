import Link from "next/link";

export default function UsePage() {
  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600 tracking-tight">Thippo</Link>
          <Link href="/lend" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">貸出したい方はこちら →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">スペース利用者向け</span>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
            必要な時間だけ、<br />
            <span className="text-purple-600">必要なスペースを。</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            会議室・作業スペース・専門設備を時間単位で借りられる。<br />
            固定費ゼロで、必要な時だけ使えます。
          </p>
          <a href="#" className="bg-purple-600 text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">
            スペースを探す
          </a>
          <p className="mt-4 text-sm text-gray-400">登録無料・すぐに検索できます</p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-16">かんたん3ステップで利用開始</h2>
          <div className="space-y-8">
            {[
              { step: "01", title: "スペースを検索", desc: "エリア・設備・日時・人数で絞り込み。地図から探すことも可能。" },
              { step: "02", title: "予約リクエストを送る", desc: "空き時間を確認してリクエスト送信。最短数分でオーナーから確定通知が届きます。" },
              { step: "03", title: "当日利用するだけ", desc: "QRコードで入室管理。鍵の受け渡し不要でスムーズに利用できます。" },
            ].map((s) => (
              <div key={s.step} className="flex gap-6 items-start p-6 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all">
                <span className="text-3xl font-bold text-purple-200 w-12 shrink-0">{s.step}</span>
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-1">{s.title}</p>
                  <p className="text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Space types */}
      <section className="py-24 px-6 bg-purple-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-16">借りられるスペース・設備</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "🏛️", label: "会議室" },
              { icon: "🎤", label: "セミナールーム" },
              { icon: "🏭", label: "工場・製造設備" },
              { icon: "🍳", label: "厨房・調理設備" },
              { icon: "📸", label: "撮影スタジオ" },
              { icon: "💻", label: "コワーキング" },
              { icon: "🔬", label: "研究・実験設備" },
              { icon: "🏋️", label: "トレーニング設備" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-6 text-center border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all">
                <span className="text-4xl">{s.icon}</span>
                <p className="text-sm font-semibold text-gray-700 mt-3">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-16">利用者に嬉しい機能</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "⚡", title: "即時予約確認", desc: "リアルタイムで空き状況を確認。最短数分で予約確定。" },
              { icon: "💰", title: "コスト削減", desc: "固定賃料なし。使った時間分だけの支払いで平均40%コスト削減。" },
              { icon: "🧾", title: "経費精算に対応", desc: "請求書・領収書を自動発行。法人の経費処理もスムーズ。" },
              { icon: "⭐", title: "レビュー・評価", desc: "利用者のレビューで安心して選べます。" },
              { icon: "🔔", title: "リマインド通知", desc: "利用前日・当日にリマインドをお知らせします。" },
              { icon: "📱", title: "スマホ対応", desc: "外出先からでもかんたんに検索・予約できます。" },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="font-semibold text-gray-900 mt-4 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-purple-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">まずは無料で検索してみましょう</h2>
          <p className="text-purple-200 mb-8">登録不要ですぐに検索できます。</p>
          <a href="#" className="bg-white text-purple-600 px-8 py-4 rounded-full text-base font-semibold hover:bg-purple-50 transition-colors">
            スペースを探す
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
