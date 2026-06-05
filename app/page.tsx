export default function Home() {
  return (
    <div className="flex flex-col min-h-full font-[family-name:var(--font-geist-sans)]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-indigo-600 tracking-tight">Thippo</span>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">機能</a>
            <a href="#how" className="hover:text-indigo-600 transition-colors">使い方</a>
            <a href="#usecase" className="hover:text-indigo-600 transition-colors">活用事例</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="#" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">ログイン</a>
            <a
              href="#"
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors"
            >
              無料で始める
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
            企業スペースのシェアリングプラットフォーム
          </span>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
            空きスペースを、<br />
            <span className="text-indigo-600">価値ある資産</span>に。
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            企業の空き部屋・会議室・設備を時間単位で貸し出し。
            遊休資産を収益化しながら、借りる側はコストを削減できます。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#"
              className="bg-indigo-600 text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              スペースを掲載する
            </a>
            <a
              href="#"
              className="bg-white text-gray-700 px-8 py-4 rounded-full text-base font-semibold border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              スペースを探す
            </a>
          </div>
          <p className="mt-6 text-sm text-gray-400">初期費用・登録料 完全無料</p>
        </div>

        {/* Stats */}
        <div className="max-w-3xl mx-auto mt-20 grid grid-cols-3 gap-8 text-center">
          {[
            { value: "1,200+", label: "掲載スペース数" },
            { value: "98%", label: "オーナー満足度" },
            { value: "40%", label: "平均コスト削減率" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-4xl font-bold text-indigo-600">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">なぜThippoが選ばれるのか</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              企業の遊休資産活用に特化した機能で、貸す側も借りる側もスムーズに。
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🏢",
                title: "多様なスペース・設備",
                desc: "会議室・セミナールーム・工場設備・厨房・スタジオなど、あらゆる企業リソースを掲載できます。",
              },
              {
                icon: "📅",
                title: "柔軟な時間単位予約",
                desc: "1時間単位から予約可能。リアルタイム空き確認で、ダブルブッキングの心配なし。",
              },
              {
                icon: "🔒",
                title: "安心の本人確認・保証",
                desc: "法人・個人事業主向けの厳格な審査と損害補償制度で、トラブルを未然に防ぎます。",
              },
              {
                icon: "💳",
                title: "自動決済・請求書対応",
                desc: "クレジットカード・銀行振込・請求書払いに対応。経費精算もスムーズです。",
              },
              {
                icon: "📊",
                title: "稼働率ダッシュボード",
                desc: "スペースの稼働状況・収益をリアルタイムで可視化。改善のヒントも提供します。",
              },
              {
                icon: "💬",
                title: "チャット・レビュー機能",
                desc: "予約前の質問から利用後のレビューまで、プラットフォーム内で完結。",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transition-all"
              >
                <span className="text-3xl">{f.icon}</span>
                <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">かんたん3ステップ</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-16">
            {/* Owner side */}
            <div>
              <h3 className="text-lg font-bold text-indigo-600 mb-8 flex items-center gap-2">
                <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded">貸す側</span>
                スペースオーナー向け
              </h3>
              <div className="space-y-6">
                {[
                  { step: "01", title: "スペースを登録", desc: "写真・設備・利用可能時間帯を入力するだけ。最短15分で掲載完了。" },
                  { step: "02", title: "予約リクエストを承認", desc: "通知を受け取り、利用者の審査・承認をワンクリックで。" },
                  { step: "03", title: "収益を受け取る", desc: "利用終了後、自動で精算。月末にまとめて振込。" },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4">
                    <span className="text-2xl font-bold text-indigo-200 w-10 shrink-0">{s.step}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{s.title}</p>
                      <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* User side */}
            <div>
              <h3 className="text-lg font-bold text-purple-600 mb-8 flex items-center gap-2">
                <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded">借りる側</span>
                スペース利用者向け
              </h3>
              <div className="space-y-6">
                {[
                  { step: "01", title: "スペースを検索", desc: "エリア・設備・日時・人数で絞り込み。地図から探すことも可能。" },
                  { step: "02", title: "予約リクエストを送る", desc: "空き時間を確認してリクエスト送信。最短数分で確定通知。" },
                  { step: "03", title: "当日利用するだけ", desc: "QRコードで入室管理。鍵の受け渡し不要でスムーズ。" },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4">
                    <span className="text-2xl font-bold text-purple-200 w-10 shrink-0">{s.step}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{s.title}</p>
                      <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="usecase" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">活用事例</h2>
            <p className="text-gray-500">さまざまな企業・業種で活用されています</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                category: "製造業",
                title: "工場の検査室を週末だけ貸し出し",
                desc: "平日しか使わない品質検査室を週末に開放。月額20万円の追加収益を実現。",
                tag: "設備・機器",
              },
              {
                category: "不動産・オフィス",
                title: "会議室の空き時間をマネタイズ",
                desc: "社内会議室の稼働率が平均40%。空き時間を外部に開放し運用コストを削減。",
                tag: "会議室",
              },
              {
                category: "飲食・フード",
                title: "深夜の厨房をフードデリバリー事業者へ",
                desc: "営業時間外の厨房設備をゴーストレストラン向けに提供。設備投資なしで収益化。",
                tag: "厨房・設備",
              },
              {
                category: "教育・研修機関",
                title: "研修室を企業研修・セミナーに貸し出し",
                desc: "学校の長期休暇中に研修室を法人向けに開放。年間400万円の収益増。",
                tag: "セミナールーム",
              },
            ].map((c) => (
              <div key={c.title} className="p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.category}</span>
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full">{c.tag}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{c.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-indigo-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            遊休スペースを、今すぐ収益に。
          </h2>
          <p className="text-indigo-200 mb-10 text-lg">
            登録・掲載は完全無料。成約時のみ手数料をいただきます。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#"
              className="bg-white text-indigo-600 px-8 py-4 rounded-full text-base font-semibold hover:bg-indigo-50 transition-colors"
            >
              スペースを無料掲載する
            </a>
            <a
              href="#"
              className="border border-indigo-400 text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-indigo-500 transition-colors"
            >
              スペースを探す
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
            <div>
              <p className="text-white font-bold text-xl mb-2">Thippo</p>
              <p className="text-sm max-w-xs">企業の空きスペース・設備をシェアするプラットフォーム</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="text-white font-semibold mb-3">サービス</p>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-white transition-colors">スペースを掲載</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">スペースを探す</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">料金プラン</a></li>
                </ul>
              </div>
              <div>
                <p className="text-white font-semibold mb-3">会社情報</p>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-white transition-colors">会社概要</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">採用情報</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">お問い合わせ</a></li>
                </ul>
              </div>
              <div>
                <p className="text-white font-semibold mb-3">サポート</p>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-white transition-colors">ヘルプセンター</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">利用規約</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">プライバシーポリシー</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-sm text-center">
            © 2025 Thippo. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
