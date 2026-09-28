"use client";

import { useActionState } from "react";
import { initialFormState } from "@thippo/auth";
import { Field, Notice, SubmitButton } from "@thippo/ui";
import { addMemberAction } from "../actions/account";

export function AddMemberForm() {
  const [state, action] = useActionState(addMemberAction, initialFormState);
  return (
    <form action={action} className="space-y-3" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <Field label="お名前" name="displayName" required error={state.fieldErrors?.displayName} />
      <Field
        label="メールアドレス"
        name="email"
        type="email"
        required
        error={state.fieldErrors?.email}
        hint="thippo の利用者として登録していないメールアドレスをお使いください。"
      />
      <SubmitButton>招待メールを送る</SubmitButton>
    </form>
  );
}
