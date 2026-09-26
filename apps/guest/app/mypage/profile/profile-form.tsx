"use client";

import { useActionState } from "react";
import { initialFormState } from "@thippo/auth";
import { Field, Notice, SubmitButton } from "@thippo/ui";
import { updateProfileAction } from "../../actions/mypage";

export function ProfileForm({ displayName, phone }: { displayName: string; phone: string }) {
  const [state, action] = useActionState(updateProfileAction, initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <Field
        label="お名前"
        name="displayName"
        autoComplete="name"
        defaultValue={displayName}
        required
        error={state.fieldErrors?.displayName}
      />
      <Field
        label="電話番号（任意）"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={phone}
        error={state.fieldErrors?.phone}
      />
      <SubmitButton>保存する</SubmitButton>
    </form>
  );
}
