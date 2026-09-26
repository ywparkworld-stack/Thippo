"use client";

import { useActionState } from "react";
import { initialFormState } from "@thippo/auth";
import { Notice, SubmitButton } from "@thippo/ui";
import {
  approveHostApplicationAction,
  rejectHostApplicationAction,
} from "../../actions/host-applications";

export function ReviewForms({ applicationId }: { applicationId: string }) {
  const [approveState, approve] = useActionState(approveHostApplicationAction, initialFormState);
  const [rejectState, reject] = useActionState(rejectHostApplicationAction, initialFormState);
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form action={approve} className="space-y-3">
        <h2 className="font-bold">承認する</h2>
        <p className="text-sm text-zinc-600">
          貸出主を作成し、担当者のメールアドレスに貸出主センターへの招待メールを送ります。
        </p>
        {approveState.error && <Notice tone="error">{approveState.error}</Notice>}
        <input type="hidden" name="applicationId" value={applicationId} />
        <SubmitButton pendingLabel="承認中…">承認して招待する</SubmitButton>
      </form>
      <form action={reject} className="space-y-3">
        <h2 className="font-bold">却下する</h2>
        {rejectState.error && <Notice tone="error">{rejectState.error}</Notice>}
        <input type="hidden" name="applicationId" value={applicationId} />
        <textarea
          name="reason"
          rows={3}
          maxLength={1000}
          placeholder="却下の理由（運営内の記録）"
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {rejectState.fieldErrors?.reason && (
          <p className="text-xs text-red-600">{rejectState.fieldErrors.reason}</p>
        )}
        <SubmitButton variant="danger">却下する</SubmitButton>
      </form>
    </div>
  );
}
