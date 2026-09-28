"use client";

import Link from "next/link";
import { useActionState } from "react";
import { initialFormState } from "@thippo/auth";
import { Field, Notice, SubmitButton } from "@thippo/ui";
import { submitHostApplicationAction } from "../../actions/host-application";

export function HostApplicationForm() {
  const [state, action] = useActionState(submitHostApplicationAction, initialFormState);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field
        label="会社名・屋号"
        name="companyName"
        required
        defaultValue={v.companyName}
        error={e.companyName}
      />
      <Field
        label="担当者のお名前"
        name="contactName"
        required
        defaultValue={v.contactName}
        error={e.contactName}
      />
      <Field
        label="メールアドレス"
        name="email"
        type="email"
        required
        defaultValue={v.email}
        error={e.email}
      />
      <Field
        label="電話番号"
        name="phone"
        type="tel"
        required
        defaultValue={v.phone}
        error={e.phone}
      />
      <Field
        label="スペースの所在地"
        name="address"
        required
        defaultValue={v.address}
        error={e.address}
      />
      <div className="space-y-1">
        <label htmlFor="note" className="block text-sm font-medium">
          備考（スペースの数・広さなど）
        </label>
        <textarea
          id="note"
          name="note"
          rows={4}
          maxLength={2000}
          defaultValue={v.note}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {e.note && <p className="text-xs text-red-600">{e.note}</p>}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agreeTerms" className="mt-1" />
        <span>
          <Link href="/terms" className="text-brand-700 underline" target="_blank">
            利用規約
          </Link>
          と
          <Link href="/privacy" className="text-brand-700 underline" target="_blank">
            プライバシーポリシー
          </Link>
          に同意します
        </span>
      </label>
      {e.agreeTerms && <p className="text-xs text-red-600">{e.agreeTerms}</p>}
      <SubmitButton>申し込む</SubmitButton>
    </form>
  );
}
