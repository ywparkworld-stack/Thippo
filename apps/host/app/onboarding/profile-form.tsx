"use client";

import { useActionState } from "react";
import { initialFormState } from "@thippo/auth";
import { Field, Notice, SubmitButton } from "@thippo/ui";
import { saveHostProfileAction } from "../actions/onboarding";

export function HostProfileForm(props: {
  companyName: string;
  invoiceRegistrationNumber: string;
  address: string;
  phone: string;
}) {
  const [state, action] = useActionState(saveHostProfileAction, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <Field
        label="会社名・屋号"
        name="companyName"
        defaultValue={props.companyName}
        required
        error={e.companyName}
      />
      <Field
        label="適格請求書発行事業者の登録番号（任意）"
        name="invoiceRegistrationNumber"
        defaultValue={props.invoiceRegistrationNumber}
        placeholder="T1234567890123"
        error={e.invoiceRegistrationNumber}
      />
      <Field
        label="所在地"
        name="address"
        defaultValue={props.address}
        required
        error={e.address}
      />
      <Field
        label="電話番号"
        name="phone"
        type="tel"
        defaultValue={props.phone}
        required
        error={e.phone}
      />
      <SubmitButton>保存する</SubmitButton>
    </form>
  );
}
