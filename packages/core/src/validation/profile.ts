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
