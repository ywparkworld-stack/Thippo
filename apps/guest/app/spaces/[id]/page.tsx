import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BOOKING,
  CANCEL_POLICY_LINES,
  addDays,
  computeDaySlots,
  formatTokyoDateTime,
  toTokyoDate,
  tokyoToUtc,
} from "@thippo/core";
import { createClient } from "@thippo/auth/server";
import { publicStorageUrl } from "@thippo/db";
import { Card, formatYen } from "@thippo/ui";
import { loadAvailability } from "../../lib/availability";
import { SlotPicker } from "./slot-picker";

/** スペース詳細（SPEC §6）。日付ごとの30分単位の空き枠から範囲を選んで予約カゴに入れる */
export default async function SpaceDetailPage(props: PageProps<"/spaces/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await props.searchParams;
  const supabase = await createClient();

  // RLS で、公開中かつ貸出主が active のスペースだけが読める
  const { data: space } = await supabase
    .from("spaces")
    .select(
      "id, host_id, name, description, address, area, capacity, amenities, price_per_30min, min_slots",
    )
    .eq("id", id)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (!space) notFound();
  const [{ data: host }, { data: photos }] = await Promise.all([
    supabase.from("public_hosts").select("company_name").eq("id", space.host_id).maybeSingle(),
    supabase
      .from("space_photos")
      .select("id, storage_path")
      .eq("space_id", id)
      .order("sort_order")
      .order("created_at"),
  ]);
  if (!host) notFound();

  const now = new Date();
  const today = toTokyoDate(now);
  const lastDate = toTokyoDate(new Date(now.getTime() + BOOKING.maxAdvanceDays * 86_400_000));
  const requested =
    typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const date = requested < today ? today : requested > lastDate ? lastDate : requested;

  const availability = await loadAvailability(
    supabase,
    [id],
    tokyoToUtc(date, 0),
    tokyoToUtc(addDays(date, 1), 0),
    date,
    date,
  );
  const slots = computeDaySlots({ date, ...availability.get(id)!, now }).map((s) => ({
    start: s.start.toISOString(),
    end: s.end.toISOString(),
    status: s.status,
  }));
  const dayLabel = (d: string) => formatTokyoDateTime(tokyoToUtc(d, 0)).slice(0, 13);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">
          {space.area}・{host.company_name}
        </p>
        <h1 className="text-2xl font-bold">{space.name}</h1>
      </div>

      {photos && photos.length > 0 && (
        <div className="grid gap-2 md:grid-cols-3">
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage の公開 URL
            <img
              key={p.id}
              src={publicStorageUrl("space-photos", p.storage_path)}
              alt={`${space.name}の写真${i + 1}`}
              className={`w-full rounded object-cover ${i === 0 ? "aspect-[4/3] md:col-span-2 md:row-span-2" : "aspect-[4/3]"}`}
            />
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card className="space-y-3">
            <h2 className="font-bold">スペースについて</h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-700">
              {space.description || "（説明はありません）"}
            </p>
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
              <dt className="text-zinc-500">所在地</dt>
              <dd>{space.address}</dd>
              <dt className="text-zinc-500">定員</dt>
              <dd>{space.capacity}人</dd>
              <dt className="text-zinc-500">料金</dt>
              <dd>
                {formatYen(space.price_per_30min)} / 30分（税込）
                {space.min_slots > 1 && `・${space.min_slots * 30}分から`}
              </dd>
              {space.amenities.length > 0 && (
                <>
                  <dt className="text-zinc-500">設備</dt>
                  <dd>{space.amenities.join("、")}</dd>
                </>
              )}
            </dl>
          </Card>
          <Card className="space-y-2">
            <h2 className="font-bold">キャンセル規定</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
              {CANCEL_POLICY_LINES.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="space-y-3 self-start">
          <h2 className="font-bold">空き状況</h2>
          <form className="flex items-center gap-2" action={`/spaces/${id}`}>
            <input
              type="date"
              name="date"
              defaultValue={date}
              min={today}
              max={lastDate}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
            />
            <button type="submit" className="rounded-md border px-3 py-1 text-sm">
              表示
            </button>
          </form>
          <div className="flex justify-between text-sm">
            {date > today ? (
              <Link href={`/spaces/${id}?date=${addDays(date, -1)}`}>← 前の日</Link>
            ) : (
              <span />
            )}
            <span className="font-medium">{dayLabel(date)}</span>
            {date < lastDate ? (
              <Link href={`/spaces/${id}?date=${addDays(date, 1)}`}>次の日 →</Link>
            ) : (
              <span />
            )}
          </div>
          <SlotPicker
            key={date}
            spaceId={id}
            hostId={space.host_id}
            slots={slots}
            minSlots={space.min_slots}
            pricePer30min={space.price_per_30min}
          />
        </Card>
      </div>
    </div>
  );
}
