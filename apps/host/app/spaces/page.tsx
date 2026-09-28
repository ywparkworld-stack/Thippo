import Link from "next/link";
import { formatYen } from "@thippo/ui";
import { Card, Notice } from "@thippo/ui";
import { onboardingState } from "@thippo/payments";
import { requireHost } from "../lib/host";

const STATUS = { draft: "非公開", published: "公開中", suspended: "運営により公開停止" } as const;

export default async function SpacesPage(props: PageProps<"/spaces">) {
  const { supabase, host } = await requireHost("/spaces");
  const searchParams = await props.searchParams;
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, name, area, capacity, price_per_30min, status")
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("created_at");
  return (
    <div className="space-y-4">
      {searchParams.deleted === "1" && <Notice tone="success">スペースを削除しました。</Notice>}
      {onboardingState(host) !== "complete" && (
        <Notice tone="warning">
          Stripe での入金先の登録が完了するまで、スペースは公開できません。
          <Link href="/onboarding" className="ml-1 underline">
            登録へ
          </Link>
        </Notice>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">スペース</h1>
        <Link href="/spaces/new" className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white">
          スペースを登録する
        </Link>
      </div>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-2">スペース名</th>
              <th className="px-4 py-2">エリア</th>
              <th className="px-4 py-2">定員</th>
              <th className="px-4 py-2">30分あたり</th>
              <th className="px-4 py-2">状態</th>
            </tr>
          </thead>
          <tbody>
            {(spaces ?? []).map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/spaces/${s.id}`} className="text-brand-700 underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{s.area}</td>
                <td className="px-4 py-2">{s.capacity}人</td>
                <td className="px-4 py-2">{formatYen(s.price_per_30min)}</td>
                <td className="px-4 py-2">{STATUS[s.status]}</td>
              </tr>
            ))}
            {(spaces ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  まだスペースがありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
