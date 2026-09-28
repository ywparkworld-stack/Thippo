import type { Enums } from "@thippo/db";

export const IDENTITY_STATUS_LABELS: Record<Enums<"identity_status">, string> = {
  unsubmitted: "未提出",
  pending: "審査中",
  approved: "確認済み",
  rejected: "再提出が必要です",
};
