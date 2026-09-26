/**
 * 1つの注文には同じ貸出主のスペースだけを含める（Destination charges の送金先は1つ。SPEC §6）。
 */
export type AddToCartCheck = { ok: true } | { ok: false; error: "different_host"; message: string };

export const DIFFERENT_HOST_MESSAGE = "予約カゴを分けて購入する必要があります";

export function checkCartHost(cartHostId: string | null, itemHostId: string): AddToCartCheck {
  if (cartHostId === null || cartHostId === itemHostId) return { ok: true };
  return { ok: false, error: "different_host", message: DIFFERENT_HOST_MESSAGE };
}

export const CART_MAX_ITEMS = 10;

/** 予約カゴの1件（ブラウザに保存するときも同じ形。金額は持たず、表示のたびにサーバーで計算する） */
export interface CartItemInput {
  spaceId: string;
  hostId: string;
  /** ISO 8601 */
  start: string;
  end: string;
}

export type MergeResult =
  | { action: "keep_server" }
  | { action: "append"; items: CartItemInput[] }
  | { action: "discard_local"; reason: "different_host" };

/**
 * ログイン時にブラウザのカゴをサーバーのカゴへ移すときの判断（付録 D18）。
 * サーバーのカゴを優先し、貸出主が違えばブラウザのカゴを捨てる。重複する時間帯・上限を超える分は移さない。
 */
export function planCartMerge(
  server: { hostId: string | null; items: readonly CartItemInput[] },
  local: readonly CartItemInput[],
): MergeResult {
  if (local.length === 0) return { action: "keep_server" };
  const localHosts = new Set(local.map((i) => i.hostId));
  if (localHosts.size > 1) return { action: "discard_local", reason: "different_host" };
  const localHost = local[0]!.hostId;
  if (server.items.length > 0 && server.hostId !== localHost) {
    return { action: "discard_local", reason: "different_host" };
  }
  const overlaps = (a: CartItemInput, b: CartItemInput) =>
    a.spaceId === b.spaceId &&
    Date.parse(a.start) < Date.parse(b.end) &&
    Date.parse(b.start) < Date.parse(a.end);
  const kept: CartItemInput[] = [];
  for (const item of local) {
    if ([...server.items, ...kept].some((x) => overlaps(x, item))) continue;
    if (server.items.length + kept.length >= CART_MAX_ITEMS) break;
    kept.push(item);
  }
  return kept.length === 0 ? { action: "keep_server" } : { action: "append", items: kept };
}
