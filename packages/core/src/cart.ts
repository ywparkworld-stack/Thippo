/**
 * 1つの注文には同じ貸出主のスペースだけを含める（Destination charges の送金先は1つ。SPEC §6）。
 */
export type AddToCartCheck = { ok: true } | { ok: false; error: "different_host"; message: string };

export const DIFFERENT_HOST_MESSAGE = "予約カゴを分けて購入する必要があります";

export function checkCartHost(cartHostId: string | null, itemHostId: string): AddToCartCheck {
  if (cartHostId === null || cartHostId === itemHostId) return { ok: true };
  return { ok: false, error: "different_host", message: DIFFERENT_HOST_MESSAGE };
}
