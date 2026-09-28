import { z } from "zod";
import { PRICING } from "../config";
import { minimumPricePer30min } from "../minimum-price";

const text = (label: string, max: number) =>
  z
    .string({ error: `${label}を入力してください` })
    .trim()
    .min(1, `${label}を入力してください`)
    .max(max, `${label}は${max}文字以内にしてください`);

const intField = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label}を数字で入力してください` })
    .int(`${label}は整数で入力してください`)
    .min(min, `${label}は${min}以上にしてください`)
    .max(max, `${label}は${max}以下にしてください`);

/** 設備：改行または読点・カンマ区切り。最大20個・1つ50文字まで */
export const amenitiesSchema = z
  .string()
  .max(2000)
  .transform((v) =>
    v
      .split(/[\n,、]/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.string().max(50, "設備の名前は50文字以内にしてください"))
      .max(20, "設備は20個までにしてください"),
  );

export const spaceSchema = z
  .object({
    name: text("スペース名", 100),
    description: z.string().trim().max(5000, "説明は5000文字以内にしてください").default(""),
    address: text("所在地", 300),
    area: text("エリア", 100),
    capacity: intField("定員", 1, 1000),
    amenities: amenitiesSchema.default([]),
    pricePer30min: intField("30分あたりの料金", 1, PRICING.maxPricePer30min),
    minSlots: intField("最低利用枠数", 1, PRICING.maxSlotsPerBooking),
  })
  .superRefine((v, ctx) => {
    // ほかの項目のエラーで値が範囲外のときは、下限の確認を行わない
    if (
      !Number.isSafeInteger(v.minSlots) ||
      v.minSlots < 1 ||
      v.minSlots > PRICING.maxSlotsPerBooking
    )
      return;
    const min = minimumPricePer30min(v.minSlots);
    if (v.pricePer30min < min) {
      ctx.addIssue({
        code: "custom",
        path: ["pricePer30min"],
        message: `最低利用枠数が${v.minSlots}枠のとき、30分あたりの料金は${min.toLocaleString("ja-JP")}円以上にしてください`,
      });
    }
  });

export type SpaceInput = z.infer<typeof spaceSchema>;

const TIME = /^([01][0-9]|2[0-3]):(00|30)$|^24:00$/;

export const availabilityRulesSchema = z
  .array(
    z.object({
      weekday: z.coerce.number().int().min(0).max(6),
      openTime: z.string().regex(TIME, "時刻は30分単位で選んでください"),
      closeTime: z.string().regex(TIME, "時刻は30分単位で選んでください"),
    }),
  )
  .max(70)
  .superRefine((rules, ctx) => {
    rules.forEach((r, i) => {
      if (r.openTime >= r.closeTime) {
        ctx.addIssue({
          code: "custom",
          path: [i],
          message: "終了時刻は開始時刻より後にしてください",
        });
      }
    });
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const a = rules[i]!;
        const b = rules[j]!;
        if (a.weekday === b.weekday && a.openTime < b.closeTime && b.openTime < a.closeTime) {
          ctx.addIssue({
            code: "custom",
            path: [j],
            message: "同じ曜日の営業時間が重なっています",
          });
        }
      }
    }
  });

export const closureSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を選んでください"),
});

export const invoiceRegistrationNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[-‐‑–—―−－ー\s]/g, "").toUpperCase())
  .refine(
    (v) => v === "" || /^T[0-9]{13}$/.test(v),
    "登録番号は「T」と13桁の数字で入力してください",
  );

export const hostProfileSchema = z.object({
  companyName: text("会社名・屋号", 200),
  invoiceRegistrationNumber: invoiceRegistrationNumberSchema
    .optional()
    .transform((v) => (v ? v : null)),
  address: text("所在地", 300),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9-]{10,20}$/, "電話番号は半角の数字とハイフンで入力してください"),
});

export const hostApplicationSchema = z.object({
  companyName: text("会社名・屋号", 200),
  contactName: text("担当者のお名前", 100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "メールアドレスの形式が正しくありません" })),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9-]{10,20}$/, "電話番号は半角の数字とハイフンで入力してください"),
  address: text("所在地", 300),
  note: z.string().trim().max(2000, "備考は2000文字以内にしてください").optional(),
  agreeTerms: z.literal("on", { error: "利用規約への同意が必要です" }),
});
