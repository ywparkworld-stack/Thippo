"use client";

import { useActionState } from "react";
import { initialFormState } from "@thippo/auth";
import { Notice, SubmitButton } from "@thippo/ui";
import { cancelBookingAction } from "../../../../actions/cancel";

export function CancelForm({ bookingId, orderId }: { bookingId: string; orderId: string }) {
  const [state, action] = useActionState(cancelBookingAction, initialFormState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="orderId" value={orderId} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" className="mt-1" required />
        <span>上記の内容でキャンセルします（取り消せません）</span>
      </label>
      <SubmitButton variant="danger" pendingLabel="キャンセル中…">
        キャンセルする
      </SubmitButton>
    </form>
  );
}
