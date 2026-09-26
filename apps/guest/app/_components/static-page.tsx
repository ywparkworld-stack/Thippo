import type { ReactNode } from "react";
import { Card, Notice } from "@thippo/ui";

/**
 * 静的ページの枠。本文は仮の文章で、運営が差し替える（SPEC §6・§16）。
 * TODO(要確認): 各ページの正式な本文。
 */
export function StaticPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Notice tone="warning">
        この文章は仮のものです。正式な内容は運営が掲載前に差し替えます。
      </Notice>
      <div className="space-y-4 text-sm leading-7 text-zinc-800 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold">
        {children}
      </div>
    </Card>
  );
}
