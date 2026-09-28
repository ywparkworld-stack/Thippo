"use client";

import { useActionState } from "react";
import { initialFormState } from "@thippo/auth";
import { Notice, SubmitButton } from "@thippo/ui";
import { withdrawAction } from "../../actions/withdraw";

export function WithdrawForm() {
  const [state, action] = useActionState(withdrawAction, initialFormState);
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        if (!confirm("退会すると元に戻せません。退会しますか？")) e.preventDefault();
      }}
    >
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" className="mt-1" />
        <span>上記を確認しました</span>
      </label>
      <SubmitButton variant="danger">退会する</SubmitButton>
    </form>
  );
}
