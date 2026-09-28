import { notFound } from "next/navigation";
import { downloadStatementPdf } from "@thippo/invoice/statements";
import { requireHost } from "../../../lib/host";

/** 発行済みの月次明細・請求書（PDF）。自社の明細であることを RLS で確かめてから返す */
export async function GET(_request: Request, ctx: RouteContext<"/sales/[month]/pdf">) {
  const { month } = await ctx.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();
  const { supabase, host } = await requireHost(`/sales/${month}`);
  const { data: statement } = await supabase
    .from("monthly_statements")
    .select("pdf_path, document_number")
    .eq("host_id", host.id)
    .eq("month", `${month}-01`)
    .not("issued_at", "is", null)
    .maybeSingle();
  if (!statement?.pdf_path) notFound();
  const pdf = await downloadStatementPdf(statement.pdf_path);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="thippo-statement-${month}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
