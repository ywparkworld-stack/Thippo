import { z } from "zod";
import { BOOKING, addDays, hasAvailableSlot, toTokyoDate, tokyoToUtc } from "@thippo/core";
import { createClient } from "@thippo/auth/server";
import { Button, Card } from "@thippo/ui";
import { SpaceCard } from "./_components/space-card";
import { loadAvailability } from "./lib/availability";

const querySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  people: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

const PAGE_SIZE = 60;

/** トップ・一覧（SPEC §6）。公開中で、貸出主が active のスペースだけを表示する */
export default async function Home(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const query = querySchema.parse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    people: typeof sp.people === "string" && sp.people !== "" ? sp.people : undefined,
    date: typeof sp.date === "string" && sp.date !== "" ? sp.date : undefined,
  });
  const now = new Date();
  const today = toTokyoDate(now);
  const lastDate = toTokyoDate(new Date(now.getTime() + BOOKING.maxAdvanceDays * 86_400_000));
  const date = query.date && query.date >= today && query.date <= lastDate ? query.date : undefined;

  const supabase = await createClient();
  const { data } = await supabase.rpc("search_spaces", {
    p_keyword: query.q ?? undefined,
    p_min_capacity: query.people ?? undefined,
    p_limit: 200,
  });
  let spaces = data ?? [];

  // 日付の指定があれば、その日に空き枠が1枠以上あるスペースだけ（付録 D17）
  if (date && spaces.length > 0) {
    const availability = await loadAvailability(
      supabase,
      spaces.map((s) => s.id),
      tokyoToUtc(date, 0),
      tokyoToUtc(addDays(date, 1), 0),
      date,
      date,
    );
    spaces = spaces.filter((s) => {
      const a = availability.get(s.id)!;
      return hasAvailableSlot({ date, ...a, now });
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <form className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end" action="/">
          <label className="space-y-1 text-sm">
            <span className="font-medium">エリア・スペース名</span>
            <input
              name="q"
              defaultValue={query.q}
              placeholder="例：渋谷、会議室"
              className="block w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">人数</span>
            <input
              name="people"
              type="number"
              min={1}
              defaultValue={query.people}
              className="block w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">日付</span>
            <input
              name="date"
              type="date"
              min={today}
              max={lastDate}
              defaultValue={date}
              className="block w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <Button type="submit">検索</Button>
        </form>
      </Card>
      <p className="text-sm text-zinc-600">
        {spaces.length > 0
          ? `${spaces.length}件のスペース`
          : "条件に合うスペースは見つかりませんでした。"}
        {spaces.length > PAGE_SIZE &&
          `（${PAGE_SIZE}件まで表示しています。条件を絞り込んでください）`}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spaces.slice(0, PAGE_SIZE).map((s) => (
          <SpaceCard key={s.id} space={s} date={date} />
        ))}
      </div>
    </div>
  );
}
