import Link from "next/link";
import { formatTokyoDateTime } from "@thippo/core";
import { Button, Card } from "@thippo/ui";
import { openStripeDashboardAction } from "../actions/onboarding";
import { requireHost } from "../lib/host";
import { AddMemberForm } from "./add-member-form";

/** アカウント設定（SPEC §9）：会社情報、担当者の追加、Stripe の管理画面へのリンク */
export default async function AccountPage() {
  const { supabase, host } = await requireHost("/account");
  const { data: members } = await supabase.rpc("host_member_list");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">アカウント設定</h1>
      <Card className="space-y-2">
        <h2 className="font-bold">会社情報・入金先</h2>
        <p className="text-sm">{host.company_name}</p>
        <Link href="/onboarding" className="text-sm text-brand-700 underline">
          会社情報・入金先の登録を変更する
        </Link>
        {host.details_submitted && (
          <form action={openStripeDashboardAction}>
            <Button type="submit" variant="secondary">
              Stripe の管理画面（入金・口座）を開く
            </Button>
          </form>
        )}
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold">担当者</h2>
        <ul className="divide-y text-sm">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex justify-between py-2">
              <span>
                {m.display_name ?? "（未設定）"}
                <br />
                <span className="text-xs text-zinc-500">{m.email}</span>
              </span>
              <span className="text-xs text-zinc-500">
                {formatTokyoDateTime(new Date(m.created_at)).slice(0, 13)}から
              </span>
            </li>
          ))}
        </ul>
        <h3 className="pt-2 text-sm font-bold">担当者を追加する</h3>
        <AddMemberForm />
      </Card>
    </div>
  );
}
