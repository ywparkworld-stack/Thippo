"use client";

import { useActionState } from "react";
import { initialFormState } from "@thippo/auth";
import { Notice, SubmitButton } from "@thippo/ui";
import { hostCancelBookingAction, recordNoShowAction } from "../../actions/bookings";

export function HostCancelForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState(hostCancelBookingAction, initialFormState);
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        if (!confirm("この予約をキャンセルし、利用者に全額を返金します。よろしいですか？"))
          e.preventDefault();
      }}
    >
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="bookingId" value={bookingId} />
      <label htmlFor="reason" className="block text-sm font-medium">
        キャンセルの理由（必須）
      </label>
      <textarea
        id="reason"
        name="reason"
        rows={3}
        maxLength={1000}
        required
        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      {state.fieldErrors?.reason && (
        <p className="text-xs text-red-600">{state.fieldErrors.reason}</p>
      )}
      <SubmitButton variant="danger" pendingLabel="キャンセル中…">
        キャンセルして全額返金する
      </SubmitButton>
    </form>
  );
}

export function NoShowForm({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState(recordNoShowAction, initialFormState);
  return (
    <form action={action} className="space-y-2">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <input type="hidden" name="bookingId" value={bookingId} />
      <SubmitButton variant="secondary">無断キャンセルとして記録する</SubmitButton>
    </form>
  );
}
