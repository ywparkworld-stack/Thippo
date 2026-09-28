import { z } from "zod";

/** 本人確認書類（SPEC §3.3, 付録 D10） */
export const IDENTITY_DOCUMENT_TYPES = [
  "drivers_license",
  "my_number_card",
  "passport",
  "residence_card",
] as const;
export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

export const IDENTITY_DOCUMENT_LABELS: Record<IdentityDocumentType, string> = {
  drivers_license: "運転免許証",
  my_number_card: "マイナンバーカード（表面のみ）",
  passport: "パスポート",
  residence_card: "在留カード",
};

/** 裏面を受け付けない書類（マイナンバーカードの裏面には個人番号がある） */
export function acceptsBackSide(type: IdentityDocumentType): boolean {
  return type !== "my_number_card";
}

export const IDENTITY_FILE = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ["image/jpeg", "image/png", "image/heic", "application/pdf"] as const,
} as const;
export type IdentityMimeType = (typeof IDENTITY_FILE.mimeTypes)[number];

export const IDENTITY_FILE_EXTENSION: Record<IdentityMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

/** 画像ファイルの先頭のバイト列から種類を判定する（スペースの写真用。WebP を含む） */
export function detectImageType(
  head: Uint8Array,
): "image/jpeg" | "image/png" | "image/webp" | null {
  const t = detectFileType(head);
  if (t === "image/jpeg" || t === "image/png") return t;
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (head.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * ファイルの先頭のバイト列から種類を判定する。拡張子や Content-Type は偽れるため、
 * アップロード後にサーバー側で中身を確かめる。
 */
export function detectFileType(head: Uint8Array): IdentityMimeType | null {
  const b = (i: number) => head[i] ?? -1;
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b(i) === v))
    return "image/png";
  if ([0x25, 0x50, 0x44, 0x46, 0x2d].every((v, i) => b(i) === v)) return "application/pdf"; // %PDF-
  // ISO BMFF: [size(4)] "ftyp" [brand(4)]
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (head.length >= 12 && ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"].includes(brand))
      return "image/heic";
  }
  return null;
}

const storagePath = z.string().min(1).max(300);

export const identitySubmissionSchema = z.object({
  documentType: z.enum(IDENTITY_DOCUMENT_TYPES, { error: "書類の種類を選んでください" }),
  frontPath: storagePath,
  backPath: storagePath.optional(),
});

export const identityReviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), documentId: z.uuid() }),
  z.object({
    decision: z.literal("reject"),
    documentId: z.uuid(),
    rejectReason: z
      .string()
      .trim()
      .min(1, "却下の理由を入力してください")
      .max(1000, "却下の理由は1000文字以内にしてください"),
    requestBackSide: z.literal("on").optional(),
  }),
]);

/** DB 関数が返すエラーコード → 画面の文言 */
export const IDENTITY_ERROR_MESSAGES: Record<string, string> = {
  identity_already_pending: "提出済みの書類を審査中です。結果をお待ちください。",
  identity_already_approved: "本人確認は完了しています。",
  my_number_back_not_allowed:
    "マイナンバーカードの裏面は提出できません。両面の提出を求められている場合は、別の書類をお選びください。",
  back_side_required: "前回の審査で両面の提出をお願いしました。裏面の画像も添付してください。",
  invalid_path: "ファイルのアップロードに失敗しました。もう一度お試しください。",
  file_not_found: "ファイルのアップロードに失敗しました。もう一度お試しください。",
  file_already_used: "ファイルのアップロードに失敗しました。もう一度お試しください。",
  document_not_found: "書類が見つかりません。",
  document_not_pending: "この書類はすでに審査済みです。",
  reject_reason_required: "却下の理由を入力してください。",
  not_allowed: "この操作を行う権限がありません。",
};

export function identityErrorMessage(dbMessage: string | undefined): string {
  const code = Object.keys(IDENTITY_ERROR_MESSAGES).find((k) => dbMessage?.includes(k));
  return code
    ? IDENTITY_ERROR_MESSAGES[code]!
    : "処理に失敗しました。時間をおいてもう一度お試しください。";
}
