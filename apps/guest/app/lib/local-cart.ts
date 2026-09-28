"use client";

import { useSyncExternalStore } from "react";
import type { CartItemInput } from "@thippo/core";

/**
 * 未ログインの間の予約カゴ（ブラウザの localStorage）。ログインしたらサーバーへ移す（SPEC §4・付録 D18）。
 * 金額は保存せず、表示のたびにサーバーで計算する。
 */
const KEY = "thippo.cart.v1";
const listeners = new Set<() => void>();
const EMPTY: CartItemInput[] = [];
let cache: { raw: string | null; items: CartItemInput[] } = { raw: null, items: EMPTY };

function read(): CartItemInput[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.items;
  let items: CartItemInput[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) items = parsed.filter(isItem).slice(0, 10);
  } catch {
    items = EMPTY;
  }
  cache = { raw, items };
  return items;
}

function isItem(v: unknown): v is CartItemInput {
  const o = v as Record<string, unknown>;
  return (
    !!o &&
    typeof o.spaceId === "string" &&
    typeof o.hostId === "string" &&
    typeof o.start === "string" &&
    typeof o.end === "string"
  );
}

function write(items: CartItemInput[]) {
  try {
    if (items.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // 保存できない（プライベートブラウズなど）場合は何もしない
  }
  listeners.forEach((l) => l());
}

export const localCart = {
  get: read,
  add(item: CartItemInput) {
    write([...read(), item]);
  },
  replace(items: CartItemInput[]) {
    write(items);
  },
  remove(index: number) {
    write(read().filter((_, i) => i !== index));
  },
  clear() {
    write([]);
  },
  hostId(): string | null {
    return read()[0]?.hostId ?? null;
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useLocalCart(): CartItemInput[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
