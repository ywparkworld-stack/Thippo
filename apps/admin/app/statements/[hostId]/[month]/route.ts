import { notFound } from "next/navigation";
import { requireAppSession } from "@thippo/auth/server";
import { downloadStatementPdf } from "@thippo/invoice/statements";
import { isUuid } from "../../../lib/format";

/** 発行済みの月次明細・請求書の PDF（運営） */
export async function GET(_request: Request, ctx: RouteContext<"/statements/[hostId]/[month]">) {
  const { hostId, month } = await ctx.params;
  if (!isUuid(hostId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();
  const { supabase } = await requireAppSession("admin");
  const { data: s } = await supabase
    .from("monthly_statements")
    .select("pdf_path")
    .eq("host_id", hostId)
    .eq("month", `${month}-01`)
    .maybeSingle();
  if (!s?.pdf_path) notFound();
  const pdf = await downloadStatementPdf(s.pdf_path);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="statement-${month}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
