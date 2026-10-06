import { requireAppSession } from "@thippo/auth/server";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { Card } from "@thippo/ui";
import { runJobAction } from "../actions/operations";
import { ActionForm } from "../_components/action-form";
import { dt } from "../lib/format";
import { jobDefinitions } from "../lib/jobs";

export const metadata = { title: "定期処理｜thippo 運営管理" };

/**
 * 定期処理（SPEC §11）。当分は自動で動かさず、運営がこの画面のボタンで実行する（付録 D39）。
 * どの処理も2回実行して結果が変わらないので、迷ったら押してよい。
 */
export default async function JobsPage() {
  await requireAppSession("admin", "/jobs");
  const jobs = jobDefinitions();
  const { data: logs } = await createSupabaseServiceClient()
    .from("audit_logs")
    .select("created_at, payload")
    .eq("action", "admin.job_run")
    .order("created_at", { ascending: false })
    .limit(200);
  const lastRun = new Map<string, string>();
  for (const l of logs ?? []) {
    const key = (l.payload as { job?: string } | null)?.job;
    if (key && !lastRun.has(key)) lastRun.set(key, l.created_at);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">定期処理</h1>
      <p className="text-sm text-zinc-700">
        当分は自動では動きません。目安の間隔でボタンを押して実行してください。どの処理も、2回押しても結果は変わりません。
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {jobs.map((job) => (
          <Card key={job.key} className="space-y-2">
            <h2 className="font-bold">{job.label}</h2>
            <p className="text-sm text-zinc-700">{job.description}</p>
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-xs text-zinc-600">
              <dt>目安</dt>
              <dd>{job.when}</dd>
              <dt>前回の実行</dt>
              <dd>{dt(lastRun.get(job.key))}</dd>
            </dl>
            <ActionForm
              action={runJobAction}
              hidden={{ job: job.key }}
              label="実行する"
              withReason={false}
              variant="secondary"
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
