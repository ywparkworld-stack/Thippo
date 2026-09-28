"use client";

import { useEffect, useState } from "react";
import { describeLocalCartAction } from "../actions/cart";
import type { EvaluatedCartItem } from "../lib/cart";
import { localCart, useLocalCart } from "../lib/local-cart";
import { CartView } from "./cart-view";

/** 未ログインの予約カゴ。金額と予約できるかはサーバーで確かめる。購入手続きにはログインが必要 */
export function LocalCart() {
  const items = useLocalCart();
  const [evaluated, setEvaluated] = useState<EvaluatedCartItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    describeLocalCartAction(items).then((r) => {
      if (!cancelled) setEvaluated(r);
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  if (!evaluated) return <p className="text-sm text-zinc-500">読み込み中…</p>;
  return (
    <CartView
      items={evaluated}
      checkoutHref="/login?next=%2Fcheckout"
      removeButton={(_, index) => (
        <button
          type="button"
          className="text-xs text-red-600 underline"
          onClick={() => localCart.remove(index)}
        >
          削除
        </button>
      )}
    />
  );
}
