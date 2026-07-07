"use client";

import Link from "next/link";
import { useState } from "react";

type Step = 1 | 2 | 3;

export default function RegisterContinuePage() {
  const [step, setStep] = useState<Step>(1);
  const [idType, setIdType] = useState("");
  const [payMethod, setPayMethod] = useState("");

  const steps = [
    { num: 1, label: "パスワード設定" },
    { num: 2, label: "身分証登録" },
    { num: 3, label: "支払い方法" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-geist-sans)]">
      <nav className="fixed top-0 w-full bg-white border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600 tracking-tight">Thippo</Link>
          <span className="text-sm text-gray-400">登録を完了してください</span>
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
                <div className={`h-0.5 w-14 sm:w-20 mx-1 mb-4 transition-colors ${step > s.num ? "bg-indigo-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: パスワード設定 */}
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">身分証の写真（表面）</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer">
                  <span className="text-4xl block mb-2">📁</span>
                  <p className="text-sm font-medium text-gray-600">クリックしてアップロード</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG（最大10MB）</p>
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
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                戻る
              </button>
              <button onClick={() => setStep(3)} className="flex-[2] bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
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
                      <p className={`text-sm font-semibold ${payMethod === item.id ? "text-indigo-700" : "text-gray-700"}`}>{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    {payMethod === item.id && <span className="ml-auto text-indigo-600 text-lg">✓</span>}
                  </button>
                ))}
              </div>
            </div>

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
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                戻る
              </button>
              <Link href="/select-role" className="flex-[2] bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-center">
                登録を完了する
              </Link>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">ステップ {step} / 3</p>
      </div>
    </div>
  );
}
