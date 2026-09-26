import "server-only";
import { randomUUID } from "node:crypto";
import { formatTokyoDateTime, toTokyoDate } from "@thippo/core";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { renderStatementPdf, type StatementDocument } from "./pdf";

const BUCKET = "statements";

/** 運営（請求書の発行者）の情報。TODO(要確認): 値は運営が設定する（SPEC §16・付録 D21） */
export function issuerFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return {
    name: env.OPERATOR_COMPANY_NAME ?? "（運営会社名）",
    address: env.OPERATOR_ADDRESS ?? "（運営会社の住所）",
    registrationNumber: env.OPERATOR_INVOICE_REGISTRATION_NUMBER ?? "（登録番号）",
  };
}

/** "2026-09" → "2026-09-01" */
export function monthStart(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError(`invalid month: ${month}`);
  return `${month}-01`;
}

/** 貸出主・月の明細の内容を集める（service role。呼び出し側で権限を確かめること） */
export async function buildStatementDocument(
  hostId: string,
  month: string,
  documentNumber: string,
): Promise<StatementDocument> {
  const service = createSupabaseServiceClient();
  const [{ data: host }, { data: summary }, { data: lines }] = await Promise.all([
    service
      .from("hosts")
      .select("company_name, address, invoice_registration_number")
      .eq("id", hostId)
      .single(),
    service.rpc("host_statement_summary", { p_host_id: hostId, p_month: monthStart(month) }),
    service.rpc("host_statement_lines", { p_host_id: hostId, p_month: monthStart(month) }),
  ]);
  if (!host || !summary?.[0]) throw new Error(`failed to load statement for ${hostId} ${month}`);
  const s = summary[0];
  return {
    documentNumber,
    month,
    issuedOn: toTokyoDate(new Date()),
    issuer: issuerFromEnv(),
    host: {
      companyName: host.company_name,
      address: host.address,
      registrationNumber: host.invoice_registration_number,
    },
    summary: {
      gross: s.gross,
      platformFeeExclTax: s.platform_fee_excl_tax,
      platformFeeTax: s.platform_fee_tax,
      stripeFee: s.stripe_fee,
      net: s.net,
    },
    lines: (lines ?? []).map((l) => ({
      date: formatTokyoDateTime(new Date(l.occurred_at)).slice(0, 10),
      kind: l.kind === "payment" ? ("決済" as const) : ("キャンセル" as const),
      orderNumber: l.order_number,
      spaceName: l.space_name,
      gross: l.gross,
      platformFee: l.platform_fee_excl_tax + l.platform_fee_tax,
      stripeFee: l.stripe_fee,
      net: l.net,
    })),
  };
}

/**
 * 月次明細と請求書を発行する（PDF をストレージに保存し、monthly_statements に記録する）。
 * 運営管理（フェーズ9）と毎月1日の定期実行（フェーズ10）から呼ぶ。発行済みの月は作り直さない。
 */
export async function issueMonthlyStatement(
  hostId: string,
  month: string,
): Promise<{ statementId: string; pdfPath: string }> {
  const documentNumber = `S-${month.replace("-", "")}-${randomUUID().slice(0, 8)}`;
  const doc = await buildStatementDocument(hostId, month, documentNumber);
  const pdf = await renderStatementPdf(doc);
  const pdfPath = `${hostId}/${month}-${documentNumber}.pdf`;
  const service = createSupabaseServiceClient();
  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error(`failed to upload statement: ${uploadError.message}`);
  const { data, error } = await service.rpc("issue_monthly_statement", {
    p_host_id: hostId,
    p_month: monthStart(month),
    p_pdf_path: pdfPath,
    p_document_number: documentNumber,
  });
  if (error || !data) {
    await service.storage.from(BUCKET).remove([pdfPath]);
    throw new Error(
      error?.message.includes("already_issued")
        ? "already_issued"
        : `failed to issue statement: ${error?.message}`,
    );
  }
  return { statementId: data, pdfPath };
}

/** 発行済みの明細の PDF を読む（service role。呼び出し側で担当者・運営であることを確かめること） */
export async function downloadStatementPdf(pdfPath: string): Promise<Blob> {
  const { data, error } = await createSupabaseServiceClient()
    .storage.from(BUCKET)
    .download(pdfPath);
  if (error || !data) throw new Error(`failed to download statement: ${error?.message}`);
  return data;
}
