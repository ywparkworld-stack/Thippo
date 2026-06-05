"use client";

import Link from "next/link";
import { useState } from "react";

type Step = 1 | 2 | 3 | 4;

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(1);
  const [idType, setIdType] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("");

  const steps = [
    { num: 1, label: "基本情報" },
    { num: 2, label: "身分証登録" },
    { num: 3, label: "支払い方法" },
    { num: 4, label: "完了" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600 tracking-tight">Thippo</Link>
          <Link href="/use" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">← スペース一覧に戻る</Link>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-6 max-w-lg mx-auto">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-10">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step > s.num
                      ? "bg-indigo-600 text-white"
                      : step === s.num
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {step > s.num ? "✓" : s.num}
                </div>
                <span className={`text-xs mt-1 font-medium ${step >= s.num ? "text-indigo-600" : "text-gray-400"}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-12 sm:w-16 mx-1 mb-4 transition-colors ${step > s.num ? "bg-indigo-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: 基本情報 */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">基本情報を入力</h2>
            <p className="text-sm text-gray-500 mb-8">スペースを借りるためのアカウントを作成します</p>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">姓</label>
                  <input type="text" placeholder="山田" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">名</label>
                  <input type="text" placeholder="太郎" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">メールアドレス</label>
                <input type="email" placeholder="taro@example.com" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">電話番号</label>
                <input type="tel" placeholder="090-0000-0000" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">パスワード</label>
                <input type="password" placeholder="8文字以上" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">利用目的</label>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-gray-700">
                  <option value="">選択してください</option>
                  <option>会議・打ち合わせ</option>
                  <option>撮影・制作</option>
                  <option>セミナー・研修</option>
                  <option>製造・作業</option>
                  <option>その他</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full mt-8 bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              次へ：身分証を登録する
            </button>
          </div>
        )}

        {/* Step 2: 身分証登録 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">身分証を登録</h2>
            <p className="text-sm text-gray-500 mb-2">安全なスペース利用のため、顔写真付き身分証の登録が必要です</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 mb-8">
              🔒 登録された情報は暗号化して保存され、スペースオーナーには開示されません
            </div>

            {/* ID type selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">身分証の種類を選択</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "drivers", label: "運転免許証", icon: "🚗" },
                  { id: "mynumber", label: "マイナンバーカード", icon: "🪪" },
                  { id: "passport", label: "パスポート", icon: "📘" },
                  { id: "residence", label: "在留カード", icon: "📄" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setIdType(item.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                      idType === item.id
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

            {/* Upload areas */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">身分証の写真（表面）</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer">
                  <span className="text-4xl block mb-2">📁</span>
                  <p className="text-sm font-medium text-gray-600">クリックしてアップロード</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG (最大10MB)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  顔写真（セルフィー）
                  <span className="ml-2 text-xs text-indigo-600 font-normal">身分証と一緒に撮影してください</span>
                </label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer">
                  <span className="text-4xl block mb-2">🤳</span>
                  <p className="text-sm font-medium text-gray-600">顔と身分証を一緒に撮影</p>
                  <p className="text-xs text-gray-400 mt-1">顔がはっきり写っているものをお使いください</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-200 text-gray-600 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-2 flex-grow bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
              >
                次へ：支払い方法を登録する
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 支払い方法 */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">支払い方法を登録</h2>
            <p className="text-sm text-gray-500 mb-2">予約確定後に自動で決済されます</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 mb-8">
              🔒 カード情報はStripeで安全に管理されます。Thippoがカード番号を保持することはありません
            </div>

            {/* Payment method selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">支払い方法を選択</label>
              <div className="space-y-3">
                {[
                  { id: "card", label: "クレジット・デビットカード", icon: "💳", desc: "Visa, Mastercard, JCB, AMEX" },
                  { id: "bank", label: "銀行振込", icon: "🏦", desc: "請求書払い（法人向け）" },
                  { id: "paypay", label: "PayPay", icon: "📱", desc: "残高・クレジットから支払い" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setPayMethod(item.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      payMethod === item.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${payMethod === item.id ? "text-indigo-700" : "text-gray-700"}`}>
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    {payMethod === item.id && <span className="ml-auto text-indigo-600 text-lg">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Card form */}
            {payMethod === "card" && (
              <div className="space-y-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">カード番号</label>
                  <input type="text" placeholder="1234 5678 9012 3456" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">有効期限</label>
                    <input type="text" placeholder="MM / YY" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">セキュリティコード</label>
                    <input type="text" placeholder="CVC" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">カード名義</label>
                  <input type="text" placeholder="TARO YAMADA" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-200 text-gray-600 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-2 flex-grow bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
              >
                登録を完了する
              </button>
            </div>
          </div>
        )}

        {/* Step 4: 完了 */}
        {step === 4 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-sm text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">登録完了！</h2>
            <p className="text-gray-500 mb-2">身分証の審査が完了次第、スペースを予約できます。</p>
            <p className="text-sm text-gray-400 mb-8">通常1〜2時間以内にメールでお知らせします</p>
            <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700 mb-8 text-left space-y-2">
              <p>✓ 基本情報の登録</p>
              <p>✓ 身分証のアップロード（審査中）</p>
              <p>✓ 支払い方法の登録</p>
            </div>
            <Link
              href="/use"
              className="block w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              本日の空きスペースを見る
            </Link>
          </div>
        )}

        {/* Progress note */}
        {step < 4 && (
          <p className="text-center text-xs text-gray-400 mt-6">
            ステップ {step} / 3 ・ すでにアカウントをお持ちの方は
            <a href="#" className="text-indigo-600 hover:underline ml-1">ログイン</a>
          </p>
        )}
      </div>
    </div>
  );
}
