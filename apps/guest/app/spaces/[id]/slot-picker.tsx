"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  DIFFERENT_HOST_MESSAGE,
  formatTokyoDateTime,
  minutesToTime,
  toTokyoMinutes,
  type SlotStatus,
} from "@thippo/core";
import { Button, Notice, formatYen } from "@thippo/ui";
import { addToCartAction } from "../../actions/cart";
import { localCart } from "../../lib/local-cart";

interface SlotView {
  start: string;
  end: string;
  status: SlotStatus;
}

const STATUS_LABEL: Record<SlotStatus, string> = {
  available: "空き",
  booked: "予約済み",
  past: "受付終了",
  beyond_window: "受付前",
};

/**
 * 開始枠と終了枠をクリックして範囲を選ぶ（SPEC §6）。最低利用枠数未満・空きでない枠を含む範囲は選べない。
 * 金額はここでは目安の表示だけで、カゴ・購入手続きではサーバーで計算し直す。
 */
export function SlotPicker(props: {
  spaceId: string;
  hostId: string;
  slots: SlotView[];
  minSlots: number;
  pricePer30min: number;
}) {
  const { slots, minSlots } = props;
  const router = useRouter();
  const [anchor, setAnchor] = useState<number | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState<{
    tone: "error" | "success" | "warning";
    text: string;
  } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [pending, startTransition] = useTransition();

  const time = (iso: string) => minutesToTime(toTokyoMinutes(new Date(iso)));

  function click(i: number) {
    setMessage(null);
    setConflict(false);
    if (slots[i]!.status !== "available") return;
    if (anchor === null || range) {
      setAnchor(i);
      setRange(null);
      return;
    }
    const [a, b] = anchor <= i ? [anchor, i] : [i, anchor];
    const contiguous = slots
      .slice(a, b + 1)
      .every((s, k, arr) => s.status === "available" && (k === 0 || arr[k - 1]!.end === s.start));
    if (!contiguous) {
      setMessage({ tone: "error", text: "空いていない時間帯を含む範囲は選べません。" });
      setAnchor(i);
      return;
    }
    if (b - a + 1 < minSlots) {
      setMessage({ tone: "error", text: `このスペースは${minSlots * 30}分から予約できます。` });
      return;
    }
    setRange([a, b]);
  }

  const selectedCount = range ? range[1] - range[0] + 1 : anchor !== null ? 1 : 0;
  const canAdd = range !== null || (anchor !== null && minSlots === 1);
  const selection = (): [number, number] | null =>
    range ?? (anchor !== null && minSlots === 1 ? [anchor, anchor] : null);

  function add(replace = false) {
    const sel = selection();
    if (!sel) return;
    const item = {
      spaceId: props.spaceId,
      hostId: props.hostId,
      start: slots[sel[0]]!.start,
      end: slots[sel[1]]!.end,
    };
    startTransition(async () => {
      // 未ログインのカゴで、別の貸出主のスペースが入っている場合
      const r = await addToCartAction(item, replace);
      if (r.ok && r.mode === "local") {
        const currentHost = localCart.hostId();
        if (currentHost && currentHost !== r.item.hostId && !replace) {
          setConflict(true);
          setMessage({ tone: "warning", text: DIFFERENT_HOST_MESSAGE });
          return;
        }
        if (replace) localCart.replace([r.item]);
        else localCart.add(r.item);
      }
      if (r.ok) {
        setMessage({ tone: "success", text: "予約カゴに入れました。" });
        setAnchor(null);
        setRange(null);
        setConflict(false);
        router.refresh();
        return;
      }
      setConflict(r.error === "different_host");
      setMessage({ tone: r.error === "different_host" ? "warning" : "error", text: r.message });
    });
  }

  if (slots.length === 0)
    return <p className="text-sm text-zinc-500">この日は営業していません。</p>;

  const sel = selection();
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">開始の枠と終了の枠をクリックしてください。</p>
      <ul className="grid grid-cols-3 gap-1 text-xs">
        {slots.map((s, i) => {
          const inRange = sel ? i >= sel[0] && i <= sel[1] : anchor === i;
          const base =
            s.status === "available"
              ? inRange
                ? "bg-brand-600 text-white"
                : "bg-white hover:bg-brand-50 border-brand-300"
              : "bg-zinc-100 text-zinc-400";
          return (
            <li key={s.start}>
              <button
                type="button"
                disabled={s.status !== "available"}
                onClick={() => click(i)}
                aria-pressed={inRange}
                className={`w-full rounded border px-1 py-2 ${base}`}
              >
                {time(s.start)}
                <br />
                <span className="text-[10px]">{inRange ? "選択中" : STATUS_LABEL[s.status]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {conflict && (
        <div className="flex flex-wrap gap-2">
          <Link href="/cart" className="rounded-md border px-3 py-2 text-sm">
            先に今のカゴを購入する
          </Link>
          <Button variant="secondary" disabled={pending} onClick={() => add(true)}>
            カゴの中身を入れ替える
          </Button>
        </div>
      )}
      {sel && (
        <div className="space-y-1 rounded-md bg-zinc-50 p-3 text-sm">
          <p>
            {formatTokyoDateTime(new Date(slots[sel[0]]!.start))}〜{time(slots[sel[1]]!.end)}（
            {selectedCount * 30}分）
          </p>
          <p>
            利用料金（目安）：
            <span className="font-bold">{formatYen(props.pricePer30min * selectedCount)}</span>
          </p>
        </div>
      )}
      <Button className="w-full" disabled={!canAdd || pending} onClick={() => add(false)}>
        {pending ? "処理中…" : "予約カゴに入れる"}
      </Button>
      <p className="text-xs text-zinc-500">予約カゴに入れただけでは、枠は確保されません。</p>
    </div>
  );
}
