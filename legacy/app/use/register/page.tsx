"use client";

import Link from "next/link";
import { useState } from "react";

export default function RegisterUsePage() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 font-[family-name:var(--font-geist-sans)]">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📧</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">メールを送信しました</h1>
          <p className="text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">{email}</span> 宛に
          </p>
          <p className="text-gray-500 mb-8">
            登録続行用のURLを送りました。<br />メールに記載のリンクから登録を完了してください。
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-left space-y-3 mb-8 shadow-sm">
            <p className="text-sm font-semibold text-gray-700">次のステップ</p>
            {["届いたメールを開く", "「登録を続ける」ボタンをクリック", "身分証・支払い方法を登録して完了"].map((t, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-gray-500">
                <span className="text-purple-600 font-bold mt-0.5">{i + 1}</span>
                <p>{t}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400 mb-6">メールが届かない場合は迷惑メールフォルダをご確認ください</p>
          <button onClick={() => setSubmitted(false)} className="text-sm text-purple-600 hover:underline">
            メールアドレスを変更して再送する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-indigo-600">Thippo</Link>
          <div className="mt-4 inline-block bg-purple-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
            拝借様向け登録
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-1">新規登録</h1>
          <p className="text-gray-500 text-sm">まずはお名前とメールアドレスを入力してください</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">姓</label>
                <input type="text" placeholder="山田" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">名</label>
                <input type="text" placeholder="太郎" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">メールアドレス</label>
              <input
                type="email"
                placeholder="taro@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1.5">このアドレスに登録続行用のメールをお送りします</p>
            </div>
          </div>

          <button
            onClick={() => { if (email) setSubmitted(true); }}
            className="w-full mt-8 bg-purple-600 text-white py-4 rounded-xl font-semibold hover:bg-purple-700 transition-colors"
          >
            登録用メールを送る
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-xs text-gray-400">または</span>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: "Googleで続ける", icon: "🔵" },
              { label: "Appleで続ける", icon: "⚫" },
            ].map((s) => (
              <button key={s.label} className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 leading-relaxed mt-6">
          登録することで
          <a href="#" className="text-purple-600 hover:underline mx-1">利用規約</a>
          および
          <a href="#" className="text-purple-600 hover:underline mx-1">プライバシーポリシー</a>
          に同意したものとみなされます
        </p>
        <p className="text-center text-sm text-gray-500 mt-4">
          <Link href="/" className="text-gray-400 hover:text-gray-600">← トップに戻る</Link>
          　・　すでにアカウントをお持ちの方は
          <Link href="/use/login" className="text-purple-600 font-semibold hover:underline ml-1">ログイン</Link>
        </p>
      </div>
    </div>
  );
}
