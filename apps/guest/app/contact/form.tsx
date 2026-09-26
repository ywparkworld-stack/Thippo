"use client";

import { useActionState } from "react";
import { CONTACT_CATEGORIES } from "@thippo/core";
import { initialFormState } from "@thippo/auth";
import { Field, Notice, SubmitButton } from "@thippo/ui";
import { submitContactAction } from "../actions/contact";

export function ContactForm() {
  const [state, action] = useActionState(submitContactAction, initialFormState);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="お名前" name="name" required defaultValue={v.name} error={e.name} />
      <Field
        label="メールアドレス"
        name="email"
        type="email"
        required
        defaultValue={v.email}
        error={e.email}
      />
      <div className="space-y-1">
        <label htmlFor="category" className="block text-sm font-medium">
          お問い合わせの種類
        </label>
        <select
          id="category"
          name="category"
          defaultValue={v.category ?? "booking"}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {Object.entries(CONTACT_CATEGORIES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="body" className="block text-sm font-medium">
          内容
        </label>
        <textarea
          id="body"
          name="body"
          rows={8}
          maxLength={5000}
          defaultValue={v.body}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {e.body && <p className="text-xs text-red-600">{e.body}</p>}
      </div>
      <SubmitButton>送信する</SubmitButton>
    </form>
  );
}
