"use client";

import Link from "next/link";
import { useState } from "react";

type Step = 1 | 2 | 3 | 4;

export default function RegisterLendPage() {
  const [step, setStep] = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  const steps = [
    { num: 1, label: "法人情報" },
    { num: 2, label: "スペース情報" },
    { num: 3, label: "振込口座" },
    { num: 4, label: "完了" },
  ];

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 font-[family-name:var(--font-geist-sans)]">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📧</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">確認メールを送信しました</h1>
          <p className="text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">{email}</span> 宛に
          </p>
          <p className="text-gray-500 mb-8">
            登録続行用のURLを送りました。<br />メールに記載のリンクから登録を完了してください。
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-left space-y-3 mb-8 shadow-sm">
            <p className="text-sm font-semibold text-gray-700">次のステップ</p>
            {["届いたメールを開く", "「登録を続ける」ボタンをクリック", "スペース情報・振込口座を登録して完了"].map((t, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-gray-500">
                <span className="text-indigo-600 font-bold mt-0.5">{i + 1}</span>
                <p>{t}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400 mb-6">メールが届かない場合は迷惑メールフォルダをご確認ください</p>
          <button onClick={() => setSubmitted(false)} className="text-sm text-indigo-600 hover:underline">
            メールアドレスを変更して再送する
          </button>
        </div>
      </div>
    );
  }

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

        {/* Step 1: 法人情報 */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">法人情報を入力</h2>
            <p className="text-sm text-gray-500 mb-8">スペースを貸し出す事業者情報を登録してください</p>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">会社名・屋号</label>
                <input type="text" placeholder="株式会社〇〇" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">担当者名（姓）</label>
                  <input type="text" placeholder="山田" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">担当者名（名）</label>
                  <input type="text" placeholder="太郎" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">メールアドレス</label>
                <input type="email" placeholder="taro@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                <p className="text-xs text-gray-400 mt-1.5">このアドレスに確認メールをお送りします</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">電話番号</label>
                <input type="tel" placeholder="03-0000-0000" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">事業形態</label>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700">
                  <option value="">選択してください</option>
                  <option>法人（株式会社・合同会社等）</option>
                  <option>個人事業主</option>
                  <option>社団法人・NPO</option>
                  <option>その他</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => { if (email) setSubmitted(true); }}
              className="w-full mt-8 bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              確認メールを送る
            </button>
            <p className="text-center text-xs text-gray-400 mt-4">
              メール内のURLから残りの情報（スペース・口座）を登録できます
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/" className="hover:text-indigo-600">← トップに戻る</Link>
          　・　すでにアカウントをお持ちの方は
          <Link href="/lend/login" className="text-indigo-600 hover:underline ml-1">ログイン</Link>
        </p>
      </div>
    </div>
  );
}
