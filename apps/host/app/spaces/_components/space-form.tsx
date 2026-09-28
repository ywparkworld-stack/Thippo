"use client";

import { useActionState, useState } from "react";
import { initialFormState, type FormState } from "@thippo/auth";
import { Field, Notice, SubmitButton } from "@thippo/ui";

export interface SpaceFormValues {
  name: string;
  description: string;
  address: string;
  area: string;
  capacity: number | "";
  amenities: string[];
  pricePer30min: number | "";
  minSlots: number;
}

export function SpaceForm({
  action,
  spaceId,
  initial,
  minPrices,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  spaceId?: string;
  initial: SpaceFormValues;
  /** 最低利用枠数ごとの料金の下限（index 0 = 1枠） */
  minPrices: number[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const [minSlots, setMinSlots] = useState(initial.minSlots);
  const e = state.fieldErrors ?? {};
  const minPrice = minPrices[minSlots - 1];
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      {spaceId && <input type="hidden" name="spaceId" value={spaceId} />}
      <Field label="スペース名" name="name" defaultValue={initial.name} required error={e.name} />
      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium">
          説明
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          maxLength={5000}
          defaultValue={initial.description}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {e.description && <p className="text-xs text-red-600">{e.description}</p>}
      </div>
      <Field
        label="所在地"
        name="address"
        defaultValue={initial.address}
        required
        error={e.address}
      />
      <Field
        label="エリア"
        name="area"
        defaultValue={initial.area}
        required
        hint="検索に使います（例：渋谷、丸の内）"
        error={e.area}
      />
      <Field
        label="定員（人）"
        name="capacity"
        type="number"
        min={1}
        max={1000}
        defaultValue={initial.capacity}
        required
        error={e.capacity}
      />
      <div className="space-y-1">
        <label htmlFor="amenities" className="block text-sm font-medium">
          設備（1行に1つ）
        </label>
        <textarea
          id="amenities"
          name="amenities"
          rows={4}
          defaultValue={initial.amenities.join("\n")}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {e.amenities && <p className="text-xs text-red-600">{e.amenities}</p>}
      </div>
      <div className="space-y-1">
        <label htmlFor="minSlots" className="block text-sm font-medium">
          最低利用時間
        </label>
        <select
          id="minSlots"
          name="minSlots"
          value={minSlots}
          onChange={(ev) => setMinSlots(Number(ev.target.value))}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n * 30}分（{n}枠）
            </option>
          ))}
        </select>
      </div>
      <Field
        label="30分あたりの料金（円・税込）"
        name="pricePer30min"
        type="number"
        min={minPrice}
        step={1}
        defaultValue={initial.pricePer30min}
        required
        hint={
          minPrice
            ? `最低利用時間が${minSlots * 30}分のとき、${minPrice.toLocaleString("ja-JP")}円以上`
            : undefined
        }
        error={e.pricePer30min}
      />
      <p className="text-xs text-zinc-500">
        料金を変更しても、予約済みの金額は変わりません。運営手数料（1時間220円）と決済手数料（3.6%）が差し引かれます。
      </p>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
