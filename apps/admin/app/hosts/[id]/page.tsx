import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppSession } from "@thippo/auth/server";
import { Card, formatYen } from "@thippo/ui";
import { setHostStatusAction, setSpaceSuspendedAction } from "../../actions/admin";
import { ActionForm } from "../../_components/action-form";
import { isUuid } from "../../lib/format";

const SPACE_STATUS = { draft: "非公開", published: "公開中", suspended: "公開停止" } as const;

export default async function HostPage(props: PageProps<"/hosts/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireAppSession("admin", `/hosts/${id}`);
  const [{ data: host }, { data: spaces }, { data: members }] = await Promise.all([
    supabase.from("hosts").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("spaces")
      .select("id, name, area, price_per_30min, status, deleted_at")
      .eq("host_id", id)
      .order("created_at"),
    supabase
      .from("host_members")
      .select("user_id, profiles(display_name, email, status)")
      .eq("host_id", id),
  ]);
  if (!host) notFound();
  return (
    <div className="space-y-4">
      <Link href="/hosts" className="text-sm text-brand-700 underline">
        貸出主一覧
      </Link>
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">{host.company_name}</h1>
        <dl className="grid grid-cols-[12rem_1fr] gap-y-1 text-sm">
          <dt className="text-zinc-500">状態</dt>
          <dd>
            {host.status === "active" ? "有効" : host.status === "suspended" ? "停止中" : "申込中"}
          </dd>
          <dt className="text-zinc-500">所在地・電話</dt>
          <dd>
            {host.address ?? "—"}・{host.phone ?? "—"}
          </dd>
          <dt className="text-zinc-500">適格請求書の登録番号</dt>
          <dd>{host.invoice_registration_number ?? "—"}</dd>
          <dt className="text-zinc-500">Stripe アカウント</dt>
          <dd>
            {host.stripe_account_id ?? "—"}（決済 {host.charges_enabled ? "可" : "不可"}・入金{" "}
            {host.payouts_enabled ? "可" : "不可"}）
          </dd>
          <dt className="text-zinc-500">担当者</dt>
          <dd>
            {(members ?? []).map((m) => {
              const p = m.profiles as {
                display_name: string | null;
                email: string;
                status: string;
              } | null;
              return (
                <Link key={m.user_id} href={`/users/${m.user_id}`} className="mr-3 underline">
                  {p?.display_name ?? p?.email}
                </Link>
              );
            })}
          </dd>
        </dl>
      </Card>
      <Card className="space-y-2">
        <h2 className="font-bold">
          {host.status === "suspended" ? "貸出主の再開" : "貸出主の停止"}
        </h2>
        <p className="text-xs text-zinc-500">
          停止すると公開中のスペースはすべて非公開になります。確定済みの予約は残ります（必要なものは予約・決済から個別に返金してください）。
        </p>
        <ActionForm
          action={setHostStatusAction}
          hidden={{ hostId: host.id, status: host.status === "suspended" ? "active" : "suspended" }}
          label={host.status === "suspended" ? "再開する" : "停止する"}
          variant={host.status === "suspended" ? "primary" : "danger"}
          confirmText={host.status === "suspended" ? undefined : "この貸出主を停止しますか？"}
        />
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold">スペース</h2>
        <ul className="divide-y">
          {(spaces ?? []).map((s) => (
            <li key={s.id} className="grid gap-2 py-3 md:grid-cols-[1fr_20rem]">
              <div className="text-sm">
                <p className="font-bold">
                  {s.name}
                  {s.deleted_at && "（削除済み）"}
                </p>
                <p className="text-zinc-500">
                  {s.area}・{formatYen(s.price_per_30min)}/30分・{SPACE_STATUS[s.status]}
                </p>
              </div>
              {!s.deleted_at && (
                <ActionForm
                  action={setSpaceSuspendedAction}
                  hidden={{
                    spaceId: s.id,
                    hostId: host.id,
                    suspended: s.status === "suspended" ? "false" : "true",
                  }}
                  label={s.status === "suspended" ? "公開停止を解除" : "公開停止にする"}
                  variant={s.status === "suspended" ? "secondary" : "danger"}
                />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
