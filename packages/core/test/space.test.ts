import { describe, expect, it } from "vitest";
import {
  availabilityRulesSchema,
  detectImageType,
  fieldErrors,
  hostProfileSchema,
  spaceSchema,
} from "../src";

const base = {
  name: "会議室A",
  description: "",
  address: "東京都千代田区1-1",
  area: "丸の内",
  capacity: "8",
  amenities: "Wi-Fi、モニター\nホワイトボード",
  pricePer30min: "1000",
  minSlots: "1",
};

describe("spaceSchema", () => {
  it("フォームの文字列を数値・配列にする", () => {
    const r = spaceSchema.parse(base);
    expect(r).toMatchObject({ capacity: 8, pricePer30min: 1000, minSlots: 1 });
    expect(r.amenities).toEqual(["Wi-Fi", "モニター", "ホワイトボード"]);
  });

  it("下限を下回る料金は受け付けない（最低利用枠数ごとの下限）", () => {
    const r = spaceSchema.safeParse({ ...base, pricePer30min: "236" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).pricePer30min).toMatch(/237円以上/);
    expect(spaceSchema.safeParse({ ...base, pricePer30min: "237" }).success).toBe(true);
    expect(spaceSchema.safeParse({ ...base, pricePer30min: "200", minSlots: "4" }).success).toBe(
      true,
    );
  });

  it("小数や範囲外の値は受け付けない", () => {
    expect(spaceSchema.safeParse({ ...base, pricePer30min: "1000.5" }).success).toBe(false);
    expect(spaceSchema.safeParse({ ...base, capacity: "0" }).success).toBe(false);
    expect(spaceSchema.safeParse({ ...base, minSlots: "49" }).success).toBe(false);
  });
});

describe("availabilityRulesSchema", () => {
  it("30分単位で、開始より後に終わり、同じ曜日で重ならないこと", () => {
    expect(
      availabilityRulesSchema.safeParse([
        { weekday: 1, openTime: "09:00", closeTime: "12:00" },
        { weekday: 1, openTime: "13:00", closeTime: "24:00" },
      ]).success,
    ).toBe(true);
    expect(
      availabilityRulesSchema.safeParse([{ weekday: 1, openTime: "09:15", closeTime: "12:00" }])
        .success,
    ).toBe(false);
    expect(
      availabilityRulesSchema.safeParse([{ weekday: 1, openTime: "12:00", closeTime: "09:00" }])
        .success,
    ).toBe(false);
    expect(
      availabilityRulesSchema.safeParse([
        { weekday: 1, openTime: "09:00", closeTime: "12:00" },
        { weekday: 1, openTime: "11:30", closeTime: "13:00" },
      ]).success,
    ).toBe(false);
  });
});

describe("hostProfileSchema", () => {
  it("適格請求書発行事業者の登録番号は任意。ハイフンや小文字を整える", () => {
    const base = { companyName: "テスト", address: "東京", phone: "03-1234-5678" };
    expect(
      hostProfileSchema.parse({ ...base, invoiceRegistrationNumber: "" }).invoiceRegistrationNumber,
    ).toBeNull();
    expect(
      hostProfileSchema.parse({ ...base, invoiceRegistrationNumber: "t1-2345-6789-0123" })
        .invoiceRegistrationNumber,
    ).toBe("T1234567890123");
    expect(
      hostProfileSchema.safeParse({ ...base, invoiceRegistrationNumber: "T123" }).success,
    ).toBe(false);
  });
});

describe("detectImageType", () => {
  it("JPEG・PNG・WebP だけを受け付ける", () => {
    const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]))).toBe(
      "image/webp",
    );
    expect(detectImageType(new Uint8Array(ascii("%PDF-1.7")))).toBeNull();
  });
});
