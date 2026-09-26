"use client";

import { useActionState } from "react";
import type { AvailabilityRule } from "@thippo/core";
import { initialFormState } from "@thippo/auth";
import { Notice, SubmitButton } from "@thippo/ui";
import { addClosureAction, saveAvailabilityAction } from "../../../actions/spaces";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const TIMES = Array.from(
  { length: 49 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);

function TimeSelect({ name, value }: { name: string; value?: string }) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
    >
      <option value="">--</option>
      {TIMES.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

export function RulesForm({ spaceId, rules }: { spaceId: string; rules: AvailabilityRule[] }) {
  const [state, action] = useActionState(saveAvailabilityAction, initialFormState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <input type="hidden" name="spaceId" value={spaceId} />
      <table className="text-sm">
        <tbody>
          {WEEKDAYS.map((label, weekday) => {
            const dayRules = rules.filter((r) => r.weekday === weekday);
            return (
              <tr key={weekday}>
                <th className="pr-4 text-left font-medium">{label}</th>
                {[0, 1].map((i) => (
                  <td key={i} className="py-1 pr-4">
                    <TimeSelect name={`open_${weekday}_${i}`} value={dayRules[i]?.openTime} />
                    <span className="px-1">〜</span>
                    <TimeSelect name={`close_${weekday}_${i}`} value={dayRules[i]?.closeTime} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <SubmitButton>営業時間を保存する</SubmitButton>
    </form>
  );
}

export function ClosureForm({ spaceId }: { spaceId: string }) {
  const [state, action] = useActionState(addClosureAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="spaceId" value={spaceId} />
      <input
        type="date"
        name="date"
        required
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
      />
      <SubmitButton variant="secondary">休業日を追加</SubmitButton>
      {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
