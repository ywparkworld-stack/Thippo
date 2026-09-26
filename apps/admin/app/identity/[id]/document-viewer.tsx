"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@thippo/ui";
import { viewIdentityDocumentAction, type DocumentFileLink } from "../../actions/identity";

/** 「表示する」を押したときにだけ署名付き URL を発行する（閲覧は操作ログに残る） */
export function DocumentViewer({ documentId }: { documentId: string }) {
  const [files, setFiles] = useState<DocumentFileLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!files) {
    return (
      <div className="space-y-2">
        {error && <Notice tone="error">{error}</Notice>}
        <p className="text-xs text-zinc-500">
          表示すると閲覧の記録が残ります。リンクの有効期限は60秒です。
        </p>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await viewIdentityDocumentAction(documentId);
              if (r.files) setFiles(r.files);
              else setError(r.error ?? "表示に失敗しました。");
            })
          }
        >
          {pending ? "準備中…" : "書類を表示する"}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {files.map((f) => (
        <figure key={f.side} className="space-y-1">
          <figcaption className="text-sm font-medium">
            {f.side === "front" ? "表面" : "裏面"}
          </figcaption>
          {/* 署名付き URL の画像。HEIC・PDF はブラウザで表示できないことがあるためリンクも出す */}
          <object
            data={f.url}
            className="h-96 w-full rounded border"
            aria-label={f.side === "front" ? "表面" : "裏面"}
          />
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-700 underline"
          >
            別のタブで開く
          </a>
        </figure>
      ))}
    </div>
  );
}
