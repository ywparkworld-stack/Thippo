import "server-only";
import { minutesToTime, timeToMinutes, type AvailabilityRule, type Interval } from "@thippo/core";
import type { ServerSupabase } from "@thippo/auth/server";

export interface SpaceAvailability {
  rules: AvailabilityRule[];
  closures: string[];
  busy: Interval[];
}

/** DB の time（"09:00:00"・"24:00:00"）を core の "HH:MM" にする */
export function toRule(r: {
  weekday: number;
  open_time: string;
  close_time: string;
}): AvailabilityRule {
  return {
    weekday: r.weekday,
    openTime: minutesToTime(timeToMinutes(r.open_time)),
    closeTime: minutesToTime(timeToMinutes(r.close_time)),
  };
}

/** 複数のスペースの営業時間・休業日・予約済みの期間をまとめて読む（空き枠の計算用） */
export async function loadAvailability(
  supabase: ServerSupabase,
  spaceIds: string[],
  from: Date,
  to: Date,
  fromDate: string,
  toDate: string,
): Promise<Map<string, SpaceAvailability>> {
  const result = new Map<string, SpaceAvailability>(
    spaceIds.map((id) => [id, { rules: [], closures: [], busy: [] }]),
  );
  if (spaceIds.length === 0) return result;
  const [rules, closures, busy] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("space_id, weekday, open_time, close_time")
      .in("space_id", spaceIds),
    supabase
      .from("closures")
      .select("space_id, date")
      .in("space_id", spaceIds)
      .gte("date", fromDate)
      .lte("date", toDate),
    supabase.rpc("spaces_busy_periods", {
      p_space_ids: spaceIds,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
  ]);
  if (rules.error || closures.error || busy.error) throw new Error("failed to load availability");
  for (const r of rules.data) result.get(r.space_id)?.rules.push(toRule(r));
  for (const c of closures.data) result.get(c.space_id)?.closures.push(c.date);
  for (const b of busy.data) {
    result
      .get(b.space_id)
      ?.busy.push({ start: new Date(b.period_start), end: new Date(b.period_end) });
  }
  return result;
}
