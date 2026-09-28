import { describe, expect, it } from "vitest";
import { invoiceTotals, renderStatementPdf, type StatementDocument } from "../src";

const doc: StatementDocument = {
  documentNumber: "S-202609-abcd1234",
  month: "2026-09",
  issuedOn: "2026-10-01",
  issuer: {
    name: "株式会社thippo",
    address: "東京都千代田区1-1",
    registrationNumber: "T1234567890123",
  },
  host: { companyName: "テスト株式会社", address: "東京都港区2-2", registrationNumber: null },
  summary: { gross: 3000, platformFeeExclTax: 400, platformFeeTax: 40, stripeFee: 108, net: 2452 },
  lines: [
    {
      date: "2026/09/10",
      kind: "決済",
      orderNumber: "T-00000001",
      spaceName: "会議室A",
      gross: 3000,
      platformFee: 440,
      stripeFee: 108,
      net: 2452,
    },
  ],
};

describe("invoiceTotals（D25）", () => {
  it("運営手数料（税込）と決済手数料をまとめ、内消費税は1回だけ切り捨てる", () => {
    expect(invoiceTotals(doc.summary)).toEqual({ platformFeeInclTax: 440, total: 548, tax: 49 }); // 548 × 10/110 = 49.8
  });
  it("返金による調整でマイナスになる月も計算できる", () => {
    expect(
      invoiceTotals({
        gross: -2000,
        platformFeeExclTax: -200,
        platformFeeTax: -20,
        stripeFee: -72,
        net: -1708,
      }),
    ).toEqual({
      platformFeeInclTax: -220,
      total: -292,
      tax: -26,
    });
  });
});

describe("renderStatementPdf", () => {
  it("日本語の PDF を作れる（請求書1ページ + 明細）", async () => {
    const bytes = await renderStatementPdf(doc);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const pages =
      Buffer.from(bytes)
        .toString("latin1")
        .match(/\/Type \/Page\b/g) ?? [];
    expect(pages).toHaveLength(2);
    expect(bytes.length).toBeLessThan(500_000); // フォントはサブセットで埋め込む
  }, 30_000);
});
