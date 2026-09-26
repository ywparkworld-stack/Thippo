import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice } from "@thippo/ui";
import { onboardingState } from "@thippo/payments";
import { updateSpaceAction } from "../../actions/spaces";
import { requireHost } from "../../lib/host";
import { minPriceTable } from "../_components/min-prices";
import { SpaceForm } from "../_components/space-form";
import { SpaceTabs } from "../_components/space-tabs";
import { DeleteSpaceForm, StatusForm } from "./status-forms";

export default async function SpacePage(props: PageProps<"/spaces/[id]">) {
  const { id } = await props.params;
  const { supabase, host } = await requireHost(`/spaces/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const searchParams = await props.searchParams;
  const { data: space } = await supabase
    .from("spaces")
    .select("*")
    .eq("id", id)
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!space) notFound();
  const [{ count: photoCount }, { count: ruleCount }] = await Promise.all([
    supabase.from("space_photos").select("id", { count: "exact", head: true }).eq("space_id", id),
    supabase
      .from("availability_rules")
      .select("id", { count: "exact", head: true })
      .eq("space_id", id),
  ]);
  const ready = onboardingState(host) === "complete";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/spaces" className="text-sm text-brand-700 underline">
        スペース一覧
      </Link>
      <h1 className="text-2xl font-bold">{space.name}</h1>
      {searchParams.created === "1" && (
        <Notice tone="success">スペースを登録しました。写真と営業時間を設定してください。</Notice>
      )}
      <SpaceTabs spaceId={id} current="info" />
      <Card className="space-y-3">
        <h2 className="font-bold">公開状態</h2>
        {space.status === "suspended" ? (
          <Notice tone="error">運営により公開停止されています。運営にお問い合わせください。</Notice>
        ) : (
          <>
            {!ready && (
              <Notice tone="warning">Stripe での入金先の登録が完了するまで公開できません。</Notice>
            )}
            {(photoCount ?? 0) === 0 && <Notice tone="info">写真が登録されていません。</Notice>}
            {(ruleCount ?? 0) === 0 && (
              <Notice tone="warning">
                営業時間が設定されていないため、予約を受け付けられません。
              </Notice>
            )}
            <StatusForm spaceId={id} status={space.status} />
          </>
        )}
      </Card>
      <Card className="space-y-4">
        <h2 className="font-bold">基本情報・料金</h2>
        <SpaceForm
          action={updateSpaceAction}
          spaceId={id}
          minPrices={minPriceTable()}
          submitLabel="保存する"
          initial={{
            name: space.name,
            description: space.description,
            address: space.address,
            area: space.area,
            capacity: space.capacity,
            amenities: space.amenities,
            pricePer30min: space.price_per_30min,
            minSlots: space.min_slots,
          }}
        />
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold">スペースの削除</h2>
        <DeleteSpaceForm spaceId={id} />
      </Card>
    </div>
  );
}
