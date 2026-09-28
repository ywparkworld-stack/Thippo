"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Notice } from "@thippo/ui";
import { mergeLocalCartAction } from "../actions/cart";
import { localCart } from "../lib/local-cart";

/**
 * ログインしているときに、ブラウザに残っているカゴをサーバーのカゴへ移す（付録 D18）。
 * 貸出主が違ってブラウザのカゴを捨てたときは、その旨を表示する。
 */
export function CartSync({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const done = useRef(false);
  const [discarded, setDiscarded] = useState(false);

  useEffect(() => {
    if (!signedIn || done.current) return;
    const items = localCart.get();
    if (items.length === 0) return;
    done.current = true;
    mergeLocalCartAction(items).then((r) => {
      localCart.clear();
      if (r.discarded) setDiscarded(true);
      if (r.merged > 0) router.refresh();
    });
  }, [signedIn, router]);

  if (!discarded) return null;
  return (
    <div className="fixed right-4 bottom-4 z-50 max-w-sm shadow-lg">
      <Notice tone="warning">
        ログイン前に予約カゴに入れたスペースは、ログイン後の予約カゴと貸出主が異なるため、予約カゴから外しました。
      </Notice>
    </div>
  );
}
