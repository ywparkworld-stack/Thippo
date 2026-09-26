import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppSession } from "@thippo/auth/server";
import { Card, formatYen } from "@thippo/ui";
import { setUserStatusAction } from "../../actions/admin";
import { ActionForm } from "../../_components/action-form";
import { ORDER_STATUS_LABELS, ROLE_LABELS, daysAgoIso, dt, isUuid } from "../../lib/format";

export default async function UserPage(props: PageProps<"/users/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireAppSession("admin", `/users/${id}`);
  const [{ data: u }, { data: orders }, { count: cancels30 }, { count: cancels24 }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("orders")
        .select("id, order_number, status, total, created_at")
        .eq("guest_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("cancel_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id)
        .gt("created_at", daysAgoIso(30)),
      supabase
        .from("cancel_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id)
        .gt("created_at", daysAgoIso(1)),
    ]);
  if (!u) notFound();
  return (
    <div className="space-y-4">
      <Link href="/users" className="text-sm text-brand-700 underline">
        利用者一覧
      </Link>
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">{u.display_name ?? "（未設定）"}</h1>
        <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
          <dt className="text-zinc-500">メールアドレス</dt>
          <dd>{u.email}</dd>
          <dt className="text-zinc-500">電話番号</dt>
          <dd>{u.phone ?? "—"}</dd>
          <dt className="text-zinc-500">種別</dt>
          <dd>{ROLE_LABELS[u.role]}</dd>
          <dt className="text-zinc-500">本人確認</dt>
          <dd>
            {u.identity_status}（
            <Link href="/identity" className="underline">
              審査
            </Link>
            ）
          </dd>
          <dt className="text-zinc-500">状態</dt>
          <dd>{u.status === "active" ? "有効" : "停止中"}</dd>
          <dt className="text-zinc-500">キャンセル回数</dt>
          <dd>
            過去24時間 {cancels24 ?? 0}回・過去30日 {cancels30 ?? 0}回
          </dd>
          <dt className="text-zinc-500">登録日</dt>
          <dd>{dt(u.created_at)}</dd>
        </dl>
      </Card>
      {u.role !== "admin" && (
        <Card className="space-y-2">
          <h2 className="font-bold">
            {u.status === "suspended" ? "アカウントの再開" : "アカウントの停止"}
          </h2>
          <p className="text-xs text-zinc-500">
            停止するとログインできなくなります。確定済みの予約は残ります。
          </p>
          <ActionForm
            action={setUserStatusAction}
            hidden={{ userId: u.id, status: u.status === "suspended" ? "active" : "suspended" }}
            label={u.status === "suspended" ? "再開する" : "停止する"}
            variant={u.status === "suspended" ? "primary" : "danger"}
            confirmText={u.status === "suspended" ? undefined : "このアカウントを停止しますか？"}
          />
        </Card>
      )}
      {u.role === "guest" && (
        <Card className="space-y-2">
          <h2 className="font-bold">注文</h2>
          <ul className="divide-y text-sm">
            {(orders ?? []).map((o) => (
              <li key={o.id} className="flex justify-between py-2">
                <Link href={`/orders/${o.id}`} className="font-mono underline">
                  {o.order_number}
                </Link>
                <span>
                  {formatYen(o.total)}・{ORDER_STATUS_LABELS[o.status]}・{dt(o.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
