import { z } from "zod";
import { AUTH } from "../config";

function withinPasswordBytes(value: string): boolean {
  return new TextEncoder().encode(value).length <= AUTH.maxPasswordBytes;
}

export const emailSchema = z
  .string({ error: "メールアドレスを入力してください" })
  .trim()
  .toLowerCase()
  .min(1, "メールアドレスを入力してください")
  .max(254, "メールアドレスが長すぎます")
  .pipe(z.email({ error: "メールアドレスの形式が正しくありません" }));

export const passwordSchema = z
  .string({ error: "パスワードを入力してください" })
  .min(AUTH.minPasswordLength, `パスワードは${AUTH.minPasswordLength}文字以上にしてください`)
  .refine(withinPasswordBytes, "パスワードが長すぎます")
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), "パスワードには英字と数字を含めてください");

export const displayNameSchema = z
  .string({ error: "お名前を入力してください" })
  .trim()
  .min(1, "お名前を入力してください")
  .max(100, "お名前は100文字以内にしてください");

export const loginSchema = z.object({
  email: emailSchema,
  // ログイン時は既存のパスワードの形式を問わない（長さの上限だけ確かめる）
  password: z
    .string()
    .min(1, "パスワードを入力してください")
    .refine(withinPasswordBytes, "パスワードが長すぎます"),
  next: z.string().max(2000).optional(),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  agreeTerms: z.literal("on", { error: "利用規約とプライバシーポリシーへの同意が必要です" }),
  next: z.string().max(2000).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "確認用のパスワードが一致しません",
    path: ["passwordConfirm"],
  });

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "6桁の数字を入力してください"),
  next: z.string().max(2000).optional(),
});

/** zod のエラーを「項目名 → 最初のメッセージ」にまとめる（フォームに表示する用）。 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}
