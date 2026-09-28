import { z } from "zod";
import { displayNameSchema } from "./auth";

export const phoneSchema = z
  .string()
  .trim()
  .max(30, "電話番号が長すぎます")
  .refine(
    (v) => v === "" || /^\+?[0-9-]{10,20}$/.test(v),
    "電話番号は半角の数字とハイフンで入力してください",
  );

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema,
  phone: phoneSchema.optional().transform((v) => (v ? v : null)),
});

export const CONTACT_CATEGORIES = {
  booking: "予約・お支払いについて",
  account: "会員登録・本人確認について",
  host: "スペースの掲載について",
  other: "その他",
} as const;

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "お名前を入力してください")
    .max(100, "お名前は100文字以内にしてください"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "メールアドレスの形式が正しくありません" })),
  category: z.enum(
    Object.keys(CONTACT_CATEGORIES) as [
      keyof typeof CONTACT_CATEGORIES,
      ...(keyof typeof CONTACT_CATEGORIES)[],
    ],
    {
      error: "お問い合わせの種類を選んでください",
    },
  ),
  body: z
    .string()
    .trim()
    .min(1, "お問い合わせの内容を入力してください")
    .max(5000, "内容は5000文字以内にしてください"),
});
