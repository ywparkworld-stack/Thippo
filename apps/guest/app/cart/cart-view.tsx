import Link from "next/link";
import { formatTokyoDateTime, minutesToTime, toTokyoMinutes, sumYen } from "@thippo/core";
import { publicStorageUrl } from "@thippo/db";
import { Card, Notice, formatYen } from "@thippo/ui";
import type { EvaluatedCartItem } from "../lib/cart";
import { CART_ITEM_ERROR_MESSAGES } from "../lib/cart-messages";

/** 予約カゴの表示（サーバーのカゴ・ブラウザのカゴで共通）。予約できない行があれば購入手続きに進めない */
export function CartView({
  items,
  removeButton,
  checkoutHref,
}: {
  items: EvaluatedCartItem[];
  removeButton: (item: EvaluatedCartItem, index: number) => React.ReactNode;
  checkoutHref: string;
}) {
  if (items.length === 0) {
    return (
      <Card className="space-y-2 text-center">
        <p className="text-zinc-600">予約カゴは空です。</p>
        <Link href="/" className="text-brand-700 underline">
          スペースを探す
        </Link>
      </Card>
    );
  }
  const invalid = items.some((i) => i.error);
  const total = sumYen(items.map((i) => i.fees?.subtotal ?? 0));
  const time = (iso: string) => minutesToTime(toTokyoMinutes(new Date(iso)));
  return (
    <div className="space-y-4">
      {invalid && (
        <Notice tone="warning">
          予約できなくなった枠があります。カゴから削除してから購入手続きに進んでください。
        </Notice>
      )}
      <Card className="divide-y p-0">
        {items.map((e, i) => (
          <div key={e.id ?? i} className="flex gap-4 p-4">
            {e.space?.coverPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage の公開 URL
              <img
                src={publicStorageUrl("space-photos", e.space.coverPath)}
                alt=""
                className="h-20 w-28 rounded object-cover"
              />
            ) : (
              <div className="h-20 w-28 rounded bg-zinc-100" />
            )}
            <div className="flex-1 space-y-1 text-sm">
              <p className="font-bold">
                {e.space ? (
                  <Link href={`/spaces/${e.space.id}`}>{e.space.name}</Link>
                ) : (
                  "（掲載が終了したスペース）"
                )}
              </p>
              {e.space && <p className="text-xs text-zinc-500">{e.space.companyName}</p>}
              <p>
                {formatTokyoDateTime(new Date(e.item.start))}〜{time(e.item.end)}
                {e.fees && `（${e.fees.slots * 30}分）`}
              </p>
              {e.error && <p className="text-red-600">{CART_ITEM_ERROR_MESSAGES[e.error]}</p>}
            </div>
            <div className="space-y-2 text-right">
              <p className="font-bold">{e.fees ? formatYen(e.fees.subtotal) : "—"}</p>
              {removeButton(e, i)}
            </div>
          </div>
        ))}
      </Card>
      <Card className="flex items-center justify-between">
        <p>
          合計（税込）：<span className="text-xl font-bold">{formatYen(total)}</span>
        </p>
        {invalid ? (
          <span className="rounded-md bg-zinc-300 px-4 py-2 text-sm text-white">
            購入手続きへ進む
          </span>
        ) : (
          <Link
            href={checkoutHref}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white"
          >
            購入手続きへ進む
          </Link>
        )}
      </Card>
      <p className="text-xs text-zinc-500">
        予約カゴに入れただけでは枠は確保されません。お支払いの時点で予約が確定します。
      </p>
    </div>
  );
}
