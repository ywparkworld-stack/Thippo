"use client";

import Link from "next/link";
import { useState } from "react";

type Step = 1 | 2 | 3 | 4;

export default function RegisterLendContinuePage() {
  const [step, setStep] = useState<Step>(1);
  const [spaceType, setSpaceType] = useState("");

  const steps = [
    { num: 1, label: "パスワード設定" },
    { num: 2, label: "スペース情報" },
    { num: 3, label: "振込口座" },
    { num: 4, label: "完了" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-geist-sans)]">
      <nav className="fixed top-0 w-full bg-white border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600 tracking-tight">Thippo</Link>
          <span className="text-sm text-indigo-100 bg-indigo-600 px-3 py-1 rounded-full font-semibold">貸与様向け登録</span>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-6 max-w-lg mx-auto">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-10">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step > s.num ? "bg-indigo-600 text-white"
                  : step === s.num ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                  : "bg-gray-200 text-gray-400"
                }`}>
                  {step > s.num ? "✓" : s.num}
                </div>
                <span className={`text-xs mt-1 font-medium whitespace-nowrap ${step >= s.num ? "text-indigo-600" : "text-gray-400"}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-10 sm:w-14 mx-1 mb-4 transition-colors ${step > s.num ? "bg-indigo-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: パスワード */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">パスワードを設定</h2>
            <p className="text-sm text-gray-500 mb-8">メールアドレスの確認ができました。次回以降のログインに使うパスワードを設定してください。</p>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">パスワード</label>
                <input type="password" placeholder="8文字以上" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                <p className="text-xs text-gray-400 mt-1.5">英字・数字を含む8文字以上</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">パスワード（確認）</label>
                <input type="password" placeholder="もう一度入力" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
            </div>
            <button onClick={() => setStep(2)} className="w-full mt-8 bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
              次へ：スペース情報を登録する
            </button>
          </div>
        )}

        {/* Step 2: スペース情報 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">スペース情報を登録</h2>
            <p className="text-sm text-gray-500 mb-8">貸し出すスペース・設備の基本情報を入力してください。後から変更・追加もできます。</p>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">スペースの種類</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "meeting", label: "会議室", icon: "🏢" },
                    { id: "seminar", label: "セミナールーム", icon: "🎤" },
                    { id: "studio", label: "撮影スタジオ", icon: "📸" },
                    { id: "kitchen", label: "厨房・調理設備", icon: "🍳" },
                    { id: "factory", label: "製造・工場設備", icon: "🏭" },
                    { id: "other", label: "その他", icon: "📦" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSpaceType(item.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                        spaceType === item.id
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 text-gray-600 hover:border-indigo-300"
                      }`}
                    >
                      <span className="text-2xl">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">スペース名</label>
                <input type="text" placeholder="例：青山オフィス 会議室A" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">住所</label>
                <input type="text" placeholder="東京都港区青山1-1-1" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">最大収容人数</label>
                  <input type="number" placeholder="10" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">料金（円/時間）</label>
                  <input type="number" placeholder="3000" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">スペースの説明</label>
                <textarea rows={3} placeholder="設備・アクセス・利用上の注意など" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">写真をアップロード</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer">
                  <span className="text-3xl block mb-2">📷</span>
                  <p className="text-sm font-medium text-gray-600">クリックして写真を追加</p>
                  <p className="text-xs text-gray-400 mt-1">最大10枚・JPG/PNG（各10MB以下）</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors">戻る</button>
              <button onClick={() => setStep(3)} className="flex-[2] bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">次へ：振込口座を登録する</button>
            </div>
          </div>
        )}

        {/* Step 3: 振込口座 */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">振込口座を登録</h2>
            <p className="text-sm text-gray-500 mb-2">収益の振込先口座を登録してください</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 mb-8">
              🔒 口座情報は暗号化して安全に管理されます。毎月末に自動で振り込まれます。
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">銀行名</label>
                <input type="text" placeholder="〇〇銀行" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">支店名</label>
                  <input type="text" placeholder="〇〇支店" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">口座種別</label>
                  <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700">
                    <option>普通</option>
                    <option>当座</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">口座番号</label>
                <input type="text" placeholder="1234567" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">口座名義（カタカナ）</label>
                <input type="text" placeholder="ヤマダ タロウ" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors">戻る</button>
              <button onClick={() => setStep(4)} className="flex-[2] bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">登録を完了する</button>
            </div>
          </div>
        )}

        {/* Step 4: 完了 */}
        {step === 4 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-sm text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">登録完了！</h2>
            <p className="text-gray-500 mb-2">スペースの審査が完了次第、掲載が開始されます。</p>
            <p className="text-sm text-gray-400 mb-8">通常1〜2営業日以内にメールでお知らせします</p>
            <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700 mb-8 text-left space-y-2">
              <p>✓ 法人情報の登録</p>
              <p>✓ スペース情報の登録（審査中）</p>
              <p>✓ 振込口座の登録</p>
            </div>
            <Link href="/lend" className="block w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
              貸与様向けページを見る
            </Link>
          </div>
        )}

        {step < 4 && <p className="text-center text-xs text-gray-400 mt-6">ステップ {step} / 3</p>}
      </div>
    </div>
  );
}
