"use client";

import { useActionState, useState, useTransition } from "react";
import {
  IDENTITY_DOCUMENT_LABELS,
  IDENTITY_DOCUMENT_TYPES,
  IDENTITY_FILE,
  IDENTITY_FILE_EXTENSION,
  acceptsBackSide,
  type IdentityDocumentType,
  type IdentityMimeType,
} from "@thippo/core";
import { initialFormState } from "@thippo/auth";
import { createSupabaseBrowserClient } from "@thippo/db/browser";
import { Button, Notice } from "@thippo/ui";
import { submitIdentityAction } from "../../actions/mypage";

/**
 * 書類の画像はブラウザから Supabase Storage の自分のフォルダへ直接アップロードし（ストレージの RLS で守る）、
 * そのパスを Server Action に渡す。Server Action がファイルの中身を確かめてから DB 関数で提出する。
 */
export function IdentityUploadForm({
  userId,
  backRequired,
}: {
  userId: string;
  backRequired: boolean;
}) {
  const [state, action] = useActionState(submitIdentityAction, initialFormState);
  const [documentType, setDocumentType] = useState<IdentityDocumentType>("drivers_license");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const backAllowed = acceptsBackSide(documentType);

  async function upload(file: File): Promise<string> {
    if (!(IDENTITY_FILE.mimeTypes as readonly string[]).includes(file.type)) {
      throw new Error("画像（JPEG・PNG・HEIC）または PDF を選んでください。");
    }
    if (file.size > IDENTITY_FILE.maxBytes) throw new Error("ファイルは10MB以内にしてください。");
    const ext = IDENTITY_FILE_EXTENSION[file.type as IdentityMimeType];
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.storage
      .from("identity-documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error("アップロードに失敗しました。時間をおいてもう一度お試しください。");
    return path;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const front = form.get("front");
    const back = form.get("back");
    setUploadError(null);
    startTransition(async () => {
      try {
        if (!(front instanceof File) || front.size === 0)
          throw new Error("表面の画像を選んでください。");
        const hasBack = backAllowed && back instanceof File && back.size > 0;
        if (backRequired && !hasBack) throw new Error("裏面の画像も選んでください。");
        const data = new FormData();
        data.set("documentType", documentType);
        data.set("frontPath", await upload(front));
        if (hasBack) data.set("backPath", await upload(back as File));
        action(data);
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "アップロードに失敗しました。");
      }
    });
  }

  const error = uploadError ?? state.error ?? state.fieldErrors?.documentType;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="space-y-1">
        <label htmlFor="documentType" className="block text-sm font-medium">
          書類の種類
        </label>
        <select
          id="documentType"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as IdentityDocumentType)}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {IDENTITY_DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t} disabled={backRequired && !acceptsBackSide(t)}>
              {IDENTITY_DOCUMENT_LABELS[t]}
            </option>
          ))}
        </select>
        {documentType === "my_number_card" && (
          <p className="text-xs text-zinc-600">
            マイナンバーカードは表面のみ提出してください。裏面は提出できません。
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor="front" className="block text-sm font-medium">
          表面の画像
        </label>
        <input
          id="front"
          name="front"
          type="file"
          accept={IDENTITY_FILE.mimeTypes.join(",")}
          required
        />
      </div>
      {backAllowed && backRequired && (
        <div className="space-y-1">
          <label htmlFor="back" className="block text-sm font-medium">
            裏面の画像
          </label>
          <input
            id="back"
            name="back"
            type="file"
            accept={IDENTITY_FILE.mimeTypes.join(",")}
            required
          />
        </div>
      )}
      <p className="text-xs text-zinc-500">
        氏名・生年月日・住所・有効期限がはっきり読めるように撮影してください。JPEG・PNG・HEIC・PDF、10MB
        まで。
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "送信中…" : "提出する"}
      </Button>
    </form>
  );
}
