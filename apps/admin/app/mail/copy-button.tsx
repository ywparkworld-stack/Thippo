"use client";

import { useState } from "react";

/** 宛先・件名・本文をクリップボードにコピーする（自分のメールソフトに貼り付けて送るため） */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "コピーしました" : label}
    </button>
  );
}
