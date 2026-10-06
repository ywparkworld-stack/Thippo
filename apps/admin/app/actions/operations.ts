"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@thippo/auth";
import { recordAudit, requireAppSession } from "@thippo/auth/server";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { jobDefinitions } from "../lib/jobs";

/**
 * 定期処理を手動で実行する（付録 D39。当分は自動で動かさない）。
 * 運営（2段階認証済み）だけが実行でき、実行したことを操作ログに残す。
 */
export async function runJobAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireAppSession("admin", "/jobs");
  const key = z.string().safeParse(formData.get("job"));
  const job = jobDefinitions().find((j) => j.key === (key.success ? key.data : ""));
  if (!job) return { error: "処理が見つかりません。" };

  const started = Date.now();
  try {
    const result = await job.run();
    await recordAudit({
      actorId: userId,
      action: "admin.job_run",
      payload: { job: job.key, result, ms: Date.now() - started },
    });
    revalidatePath("/jobs");
    revalidatePath("/mail");
    return { message: `「${job.label}」を実行しました。結果：${summarize(result)}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[job] ${job.key} failed: ${message}`);
    await recordAudit({
      actorId: userId,
      action: "admin.job_run",
      payload: { job: job.key, error: message.slice(0, 1000) },
    }).catch(() => undefined);
    return { error: `「${job.label}」に失敗しました：${message.slice(0, 300)}` };
  }
}

const RESULT_LABELS: Record<string, string> = {
  expired: "期限切れにした注文",
  cancelFailures: "取り消せなかった支払い",
  completed: "利用済みにした予約",
  sent: "作ったメール",
  date: "対象日",
  month: "対象月",
  issued: "発行した貸出主",
  updated: "更新した注文",
  purgedCounters: "削除したレート制限の記録",
  orphanFiles: "削除したファイル",
  purgedDocuments: "削除した書類",
};

function summarize(result: Record<string, unknown>): string {
  const parts = Object.entries(result)
    .filter(([k]) => k in RESULT_LABELS)
    .map(([k, v]) => `${RESULT_LABELS[k]} ${String(v)}`);
  return parts.length > 0 ? parts.join("、") : "完了";
}

/**
 * 送信待ちのメールを「送信済み」にする（運営が自分のメールソフトから送ったあと。付録 D39）。
 */
export async function markMailSentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireAppSession("admin", "/mail");
  const id = z.uuid().safeParse(formData.get("notificationId"));
  if (!id.success) return { error: "メールが見つかりません。" };
  const { data, error } = await createSupabaseServiceClient()
    .from("notifications")
    .update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: "manual" })
    .eq("id", id.data)
    .eq("status", "queued")
    .select("id, template")
    .maybeSingle();
  if (error) return { error: "更新に失敗しました。時間をおいてもう一度お試しください。" };
  if (!data) return { error: "すでに送信済みか、見つかりません。" };
  await recordAudit({
    actorId: userId,
    action: "admin.mail_mark_sent",
    targetTable: "notifications",
    targetId: data.id,
    payload: { template: data.template },
  });
  revalidatePath("/mail");
  return { message: "送信済みにしました。" };
}

/** 送らないことにしたメール（宛先の誤り・重複など）を、送信待ちの一覧から外す */
export async function discardMailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireAppSession("admin", "/mail");
  const p = z
    .object({
      notificationId: z.uuid(),
      reason: z.string().trim().min(1, "理由を入力してください").max(1000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "入力をご確認ください。" };
  const { data, error } = await createSupabaseServiceClient()
    .from("notifications")
    .update({ status: "failed", error: `送らない（運営）：${p.data.reason}` })
    .eq("id", p.data.notificationId)
    .eq("status", "queued")
    .select("id, template")
    .maybeSingle();
  if (error) return { error: "更新に失敗しました。時間をおいてもう一度お試しください。" };
  if (!data) return { error: "すでに処理済みか、見つかりません。" };
  await recordAudit({
    actorId: userId,
    action: "admin.mail_discard",
    targetTable: "notifications",
    targetId: data.id,
    payload: { template: data.template, reason: p.data.reason },
  });
  revalidatePath("/mail");
  return { message: "送らないメールとして一覧から外しました。" };
}
