import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import PDFDocument from "pdfkit";
import { includedConsumptionTax } from "@thippo/core";

/** 月次明細と運営手数料の請求書（適格請求書）の内容（SPEC §9・付録 D12・D24・D25） */
export interface StatementDocument {
  /** 書類番号（例: S-202609-xxxxxxxx） */
  documentNumber: string;
  /** 対象月 "YYYY-MM"（決済日・キャンセル日の月。付録 D24） */
  month: string;
  /** 発行日 "YYYY-MM-DD" */
  issuedOn: string;
  issuer: { name: string; address: string; registrationNumber: string };
  host: { companyName: string; address: string | null; registrationNumber: string | null };
  summary: {
    /** 利用者のお支払い合計（返金を差し引いた額） */
    gross: number;
    platformFeeExclTax: number;
    platformFeeTax: number;
    /** 決済手数料（見込み額。税込として扱う。D12） */
    stripeFee: number;
    /** 振込額 */
    net: number;
  };
  lines: StatementLine[];
}

export interface StatementLine {
  /** "YYYY/MM/DD" */
  date: string;
  kind: "決済" | "キャンセル";
  orderNumber: string;
  spaceName: string;
  gross: number;
  platformFee: number;
  stripeFee: number;
  net: number;
}

const require = createRequire(import.meta.url);
let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadFonts() {
  if (!fontCache) {
    // フォントのファイルはバンドルせず実行時に読む（デプロイには next.config の outputFileTracingIncludes で含める）
    const dir = dirname(require.resolve("@expo-google-fonts/noto-sans-jp/package.json"));
    const [regular, bold] = await Promise.all([
      readFile(join(dir, "400Regular", "NotoSansJP_400Regular.ttf")),
      readFile(join(dir, "700Bold", "NotoSansJP_700Bold.ttf")),
    ]);
    fontCache = { regular, bold };
  }
  return fontCache;
}

const yen = (n: number) => `${n < 0 ? "-" : ""}¥${Math.abs(n).toLocaleString("ja-JP")}`;

/**
 * 請求書の10%対象の合計と内消費税。運営手数料（税込）と決済手数料（税込として扱う）をまとめ、
 * 内消費税は書類ごとに1回だけ切り捨てで計算する（付録 D25）。
 */
export function invoiceTotals(summary: StatementDocument["summary"]) {
  const platformFeeInclTax = summary.platformFeeExclTax + summary.platformFeeTax;
  const total = platformFeeInclTax + summary.stripeFee;
  const tax = total >= 0 ? includedConsumptionTax(total) : -includedConsumptionTax(-total);
  return { platformFeeInclTax, total, tax };
}

type Doc = InstanceType<typeof PDFDocument>;

const LEFT = 40;
const RIGHT = 555;

function text(
  doc: Doc,
  s: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; right?: boolean } = {},
) {
  doc.font(opts.bold ? "bold" : "regular").fontSize(opts.size ?? 9);
  const w = doc.widthOfString(s);
  doc.text(s, opts.right ? x - w : x, y, { lineBreak: false });
}

function rule(doc: Doc, y: number) {
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor("#999999").stroke();
}

/** 月次明細と請求書の PDF を作る（A4 縦。フォントはサブセットで埋め込む） */
export async function renderStatementPdf(data: StatementDocument): Promise<Uint8Array> {
  const fonts = await loadFonts();
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    info: { Title: `thippo 月次明細・請求書 ${data.month}` },
  });
  doc.registerFont("regular", Buffer.from(fonts.regular));
  doc.registerFont("bold", Buffer.from(fonts.bold));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  const [y4, m] = data.month.split("-");
  const monthLabel = `${y4}年${Number(m)}月`;
  const totals = invoiceTotals(data.summary);

  // 1ページ目：請求書（適格請求書）
  let y = 50;
  text(doc, "請求書（適格請求書）", LEFT, y, { size: 18, bold: true });
  text(doc, `No. ${data.documentNumber}`, RIGHT, y, { right: true });
  text(doc, `発行日 ${data.issuedOn.replaceAll("-", "/")}`, RIGHT, y + 14, { right: true });
  y += 60;
  text(doc, `${data.host.companyName} 御中`, LEFT, y, { size: 13, bold: true });
  rule(doc, y + 20);
  y += 26;
  if (data.host.address) text(doc, data.host.address, LEFT, y);
  y += 36;
  text(doc, `${monthLabel}分の運営手数料・決済手数料を、下記のとおりご請求いたします。`, LEFT, y, {
    size: 10,
  });
  y += 16;
  text(doc, "本請求額は、振込額から差し引き済みです（別途のお支払いは不要です）。", LEFT, y);
  y += 34;
  text(doc, "ご請求金額（税込）", LEFT, y + 4, { size: 12 });
  text(doc, yen(totals.total), RIGHT, y, { size: 16, bold: true, right: true });
  rule(doc, y + 24);
  y += 44;
  text(doc, "品目", LEFT, y, { bold: true });
  text(doc, "金額（税込）", RIGHT, y, { bold: true, right: true });
  rule(doc, y + 14);
  y += 22;
  text(doc, `運営手数料（${monthLabel}分・10%対象）`, LEFT, y);
  text(doc, yen(totals.platformFeeInclTax), RIGHT, y, { right: true });
  y += 16;
  text(doc, `決済手数料（${monthLabel}分・10%対象）`, LEFT, y);
  text(doc, yen(data.summary.stripeFee), RIGHT, y, { right: true });
  rule(doc, y + 14);
  y += 24;
  text(doc, "10%対象 合計（税込）", 330, y);
  text(doc, yen(totals.total), RIGHT, y, { right: true });
  y += 16;
  text(doc, "うち消費税（10%）", 330, y);
  text(doc, yen(totals.tax), RIGHT, y, { right: true });
  y += 50;
  text(doc, data.issuer.name, LEFT, y, { size: 11, bold: true });
  text(doc, data.issuer.address, LEFT, y + 18);
  text(doc, `登録番号 ${data.issuer.registrationNumber}`, LEFT, y + 34);

  // 2ページ目以降：月次明細
  doc.addPage();
  y = 50;
  text(doc, `月次明細（${monthLabel}）`, LEFT, y, { size: 16, bold: true });
  y += 36;
  const rows: [string, number][] = [
    ["利用者のお支払い合計（返金を差し引いた額）", data.summary.gross],
    ["運営手数料（税抜）", -data.summary.platformFeeExclTax],
    ["運営手数料の消費税", -data.summary.platformFeeTax],
    ["決済手数料", -data.summary.stripeFee],
  ];
  for (const [label, value] of rows) {
    text(doc, label, LEFT, y);
    text(doc, yen(value), RIGHT, y, { right: true });
    y += 16;
  }
  rule(doc, y);
  y += 8;
  text(doc, "振込額", LEFT, y, { bold: true });
  text(doc, yen(data.summary.net), RIGHT, y, { bold: true, right: true });
  y += 36;

  const header = () => {
    text(doc, "日付", LEFT, y, { size: 8, bold: true });
    text(doc, "区分", 95, y, { size: 8, bold: true });
    text(doc, "注文番号", 145, y, { size: 8, bold: true });
    text(doc, "スペース", 205, y, { size: 8, bold: true });
    text(doc, "お支払い", 380, y, { size: 8, bold: true, right: true });
    text(doc, "運営手数料", 440, y, { size: 8, bold: true, right: true });
    text(doc, "決済手数料", 500, y, { size: 8, bold: true, right: true });
    text(doc, "振込額", RIGHT, y, { size: 8, bold: true, right: true });
    rule(doc, y + 12);
    y += 18;
  };
  header();
  for (const l of data.lines) {
    if (y > 790) {
      doc.addPage();
      y = 50;
      header();
    }
    text(doc, l.date, LEFT, y, { size: 8 });
    text(doc, l.kind, 95, y, { size: 8 });
    text(doc, l.orderNumber, 145, y, { size: 8 });
    text(doc, l.spaceName.slice(0, 14), 205, y, { size: 8 });
    text(doc, yen(l.gross), 380, y, { size: 8, right: true });
    text(doc, yen(l.platformFee), 440, y, { size: 8, right: true });
    text(doc, yen(l.stripeFee), 500, y, { size: 8, right: true });
    text(doc, yen(l.net), RIGHT, y, { size: 8, right: true });
    y += 14;
  }

  doc.end();
  await done;
  return new Uint8Array(Buffer.concat(chunks));
}
