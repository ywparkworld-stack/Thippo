import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Vercel Cron からの呼び出しか（Authorization: Bearer <CRON_SECRET>） */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** 定期実行の Route Handler を作る。結果は JSON で返し、失敗は 500 にする（Vercel のログに残る） */
export function cronRoute(name: string, job: () => Promise<Record<string, unknown>>) {
  return async function GET(request: Request): Promise<Response> {
    if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
    const started = Date.now();
    try {
      const result = await job();
      console.info(`[cron] ${name} ok ${Date.now() - started}ms ${JSON.stringify(result)}`);
      return Response.json({ ok: true, ...result });
    } catch (e) {
      console.error(`[cron] ${name} failed: ${(e as Error).message}`);
      return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
    }
  };
}
