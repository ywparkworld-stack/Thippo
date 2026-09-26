"use client";

import { useActionState } from "react";
import { initialFormState, type FormState } from "@thippo/auth";
import { Notice, SubmitButton } from "@thippo/ui";

/**
 * 運営の操作のフォーム（hidden の値・理由の入力・確認のダイアログ）。
 * 理由は操作ログに残る。
 */
export function ActionForm({
  action,
  hidden,
  label,
  confirmText,
  withReason = true,
  variant = "primary",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  label: string;
  confirmText?: string;
  withReason?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
    >
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {withReason && (
        <textarea
          name="reason"
          rows={2}
          maxLength={1000}
          required
          placeholder="理由（操作ログに残ります）"
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      )}
      <SubmitButton variant={variant}>{label}</SubmitButton>
    </form>
  );
}
