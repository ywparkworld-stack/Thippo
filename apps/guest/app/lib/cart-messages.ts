import type { SelectionError } from "@thippo/core";

export type CartItemError = SelectionError | "space_unavailable";

export const CART_ITEM_ERROR_MESSAGES: Record<CartItemError, string> = {
  space_unavailable: "このスペースは現在予約を受け付けていません。",
  not_aligned: "時間は30分単位で選んでください。",
  invalid_range: "終了時刻は開始時刻より後にしてください。",
  below_min_slots: "最低利用時間に足りません。",
  too_many_slots: "1回の予約は24時間までです。",
  outside_opening_hours: "営業時間外の時間帯が含まれています。",
  not_available:
    "この時間帯は予約できなくなりました（他の方が予約したか、受付期間を過ぎています）。",
};
