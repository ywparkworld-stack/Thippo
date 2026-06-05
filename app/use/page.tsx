import Link from "next/link";

const TODAY_SPACES = [
  {
    id: 1,
    name: "青山 会議室A",
    type: "会議室",
    area: "東京都港区青山",
    capacity: 8,
    pricePerHour: 3000,
    slots: ["10:00〜", "13:00〜", "16:00〜"],
    tags: ["WiFi", "プロジェクター", "ホワイトボード"],
    emoji: "🏢",
    color: "indigo",
  },
  {
    id: 2,
    name: "渋谷 撮影スタジオ",
    type: "撮影スタジオ",
    area: "東京都渋谷区",
    capacity: 4,
    pricePerHour: 8000,
    slots: ["11:00〜", "15:00〜"],
    tags: ["照明設備", "更衣室", "背景紙"],
    emoji: "📸",
    color: "purple",
  },
  {
    id: 3,
    name: "新宿 セミナールーム",
    type: "セミナールーム",
    area: "東京都新宿区",
    capacity: 30,
    pricePerHour: 12000,
    slots: ["09:00〜", "14:00〜"],
    tags: ["マイク", "プロジェクター", "受付スペース"],
    emoji: "🎤",
    color: "blue",
  },
  {
    id: 4,
    name: "品川 厨房設備",
    type: "厨房・調理設備",
    area: "東京都品川区",
    capacity: 6,
    pricePerHour: 5000,
    slots: ["08:00〜", "12:00〜", "17:00〜"],
    tags: ["業務用コンロ", "冷蔵庫", "食洗機"],
    emoji: "🍳",
    color: "orange",
  },
  {
    id: 5,
    name: "大田区 工場スペース",
    type: "製造・工場設備",
    area: "東京都大田区",
    capacity: 10,
    pricePerHour: 15000,
    slots: ["09:00〜", "13:00〜"],
    tags: ["クレーン", "電源200V", "搬入口"],
    emoji: "🏭",
    color: "gray",
  },
  {
    id: 6,
    name: "恵比寿 コワーキング",
    type: "コワーキング",
    area: "東京都渋谷区恵比寿",
    capacity: 1,
    pricePerHour: 800,
    slots: ["今すぐ利用可"],
    tags: ["WiFi", "電源", "カフェ併設"],
    emoji: "💻",
    color: "green",
  },
];

const colorMap: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
  purple: "bg-purple-50 text-purple-700 border-purple-100",
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  orange: "bg-orange-50 text-orange-700 border-orange-100",
  gray: "bg-gray-50 text-gray-700 border-gray-100",
  green: "bg-green-50 text-green-700 border-green-100",
};

const slotColorMap: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-700",
  purple: "bg-purple-100 text-purple-700",
  blue: "bg-blue-100 text-blue-700",
  orange: "bg-orange-100 text-orange-700",
  gray: "bg-gray-100 text-gray-700",
  green: "bg-green-100 text-green-700",
};

export default function UsePage() {
  const today = new Date().toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600 tracking-tight">Thippo</Link>
          <div className="flex items-center gap-4">
            <Link href="/lend" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors hidden sm:block">貸出したい方はこちら →</Link>
            <Link href="/register" className="text-sm bg-purple-600 text-white px-4 py-2 rounded-full hover:bg-purple-700 transition-colors">無料登録</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-10 px-6 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <span className="inline-block bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full mb-3 animate-pulse">● 本日の空きスペース</span>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{today}の空きスペース</h1>
              <p className="text-gray-500 mt-2">今日使えるスペースをすぐに予約。当日から利用開始できます。</p>
            </div>
            <p className="text-sm text-gray-400 shrink-0">{TODAY_SPACES.length}件のスペースが利用可能</p>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {["すべて", "会議室", "セミナールーム", "撮影スタジオ", "厨房・設備", "コワーキング"].map((f) => (
              <button
                key={f}
                className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                  f === "すべて"
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-purple-400 hover:text-purple-600"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Space list */}
      <section className="py-10 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TODAY_SPACES.map((space) => (
            <div
              key={space.id}
              className="bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:border-purple-200 transition-all overflow-hidden"
            >
              {/* Card header */}
              <div className={`px-5 py-4 border-b ${colorMap[space.color]}`}>
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{space.emoji}</span>
                  <span className="text-xs font-semibold px-2 py-1 bg-white/70 rounded-full">{space.type}</span>
                </div>
              </div>

              {/* Card body */}
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-1">{space.name}</h3>
                <p className="text-sm text-gray-400 mb-3">📍 {space.area} · 最大{space.capacity}名</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {space.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{tag}</span>
                  ))}
                </div>

                {/* Time slots */}
                <p className="text-xs text-gray-500 font-semibold mb-2">本日の空き時間</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {space.slots.map((slot) => (
                    <span key={slot} className={`text-xs font-semibold px-3 py-1 rounded-full ${slotColorMap[space.color]}`}>
                      {slot}
                    </span>
                  ))}
                </div>

                {/* Price & CTA */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    <span className="text-xl font-bold text-gray-900">¥{space.pricePerHour.toLocaleString()}</span>
                    <span className="text-sm text-gray-400"> / 時間</span>
                  </div>
                  <Link href="/register" className="bg-purple-600 text-white text-sm px-4 py-2 rounded-full hover:bg-purple-700 transition-colors font-semibold">
                    今すぐ予約
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-10">当日でも、今すぐ使える</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: "01", icon: "🔍", title: "スペースを選ぶ", desc: "今日空いているスペースを検索して選ぶだけ。" },
              { step: "02", icon: "✅", title: "即時予約確定", desc: "リクエスト送信後、最短数分でオーナーから確定通知。" },
              { step: "03", icon: "🚪", title: "当日すぐ利用", desc: "QRコードで入室。鍵の受け渡し不要。" },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <span className="text-4xl mb-3">{s.icon}</span>
                <p className="font-bold text-gray-900 mb-1">{s.title}</p>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
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
