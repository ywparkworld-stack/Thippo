"use client";

import { useActionState, useState } from "react";
import { initialFormState } from "@thippo/auth";
import { Notice, SubmitButton } from "@thippo/ui";
import { reviewIdentityAction } from "../../actions/identity";

export function ReviewForm({ documentId }: { documentId: string }) {
  const [state, action] = useActionState(reviewIdentityAction, initialFormState);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  return (
    <form action={action} className="space-y-4">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="documentId" value={documentId} />
      <fieldset className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="decision"
            value="approve"
            checked={decision === "approve"}
            onChange={() => setDecision("approve")}
          />
          承認する
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="decision"
            value="reject"
            checked={decision === "reject"}
            onChange={() => setDecision("reject")}
          />
          却下する
        </label>
      </fieldset>
      {decision === "reject" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="rejectReason" className="block text-sm font-medium">
              却下の理由（利用者にメールで伝わります）
            </label>
            <textarea
              id="rejectReason"
              name="rejectReason"
              required
              maxLength={1000}
              rows={4}
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            {state.fieldErrors?.rejectReason && (
              <p className="text-xs text-red-600">{state.fieldErrors.rejectReason}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requestBackSide" />
            次の提出で両面（表面と裏面）を求める
          </label>
        </div>
      )}
      <SubmitButton variant={decision === "reject" ? "danger" : "primary"}>
        {decision === "reject" ? "却下して通知する" : "承認して通知する"}
      </SubmitButton>
    </form>
  );
}
