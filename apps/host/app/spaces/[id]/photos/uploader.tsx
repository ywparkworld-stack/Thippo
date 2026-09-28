"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SPACE_PHOTO } from "@thippo/core";
import { createSupabaseBrowserClient } from "@thippo/db/browser";
import { Notice } from "@thippo/ui";
import { addSpacePhotoAction } from "../../../actions/spaces";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/** 写真はブラウザから公開バケットの <space_id>/ に直接アップロードし（ストレージの RLS で自社のスペースに限る）、サーバーで確かめて登録する */
export function PhotoUploader({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      if (!(file.type in EXT)) return setError("JPEG・PNG・WebP の画像を選んでください。");
      if (file.size > SPACE_PHOTO.maxBytes) return setError("画像は10MB以内にしてください。");
      const path = `${spaceId}/${crypto.randomUUID()}.${EXT[file.type as keyof typeof EXT]}`;
      const { error: uploadError } = await createSupabaseBrowserClient()
        .storage.from("space-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError)
        return setError("アップロードに失敗しました。時間をおいてもう一度お試しください。");
      const r = await addSpacePhotoAction(spaceId, path);
      if (r.error) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error && <Notice tone="error">{error}</Notice>}
      <label className="inline-block cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-sm">
        {pending ? "アップロード中…" : "写真を追加する"}
        <input
          type="file"
          accept={SPACE_PHOTO.mimeTypes.join(",")}
          className="hidden"
          onChange={onChange}
          disabled={pending}
        />
      </label>
    </div>
  );
}
