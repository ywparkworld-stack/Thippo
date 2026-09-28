"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button, Field, Notice, SubmitButton } from "@thippo/ui";
import { initialFormState, type FormState } from "./form-state";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

function FormMessages({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
    </>
  );
}

export function LoginForm({
  action,
  next,
  notice,
  forgotHref = "/password/forgot",
  signupHref,
}: {
  action: Action;
  next?: string;
  notice?: string | null;
  forgotHref?: string;
  signupHref?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {notice && !state.error && <Notice tone="warning">{notice}</Notice>}
      <FormMessages state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="メールアドレス"
        name="email"
        type="email"
        autoComplete="username"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="パスワード"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <SubmitButton className="w-full" pendingLabel="ログイン中…">
        ログイン
      </SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href={forgotHref} className="text-brand-700 underline">
          パスワードを忘れた方
        </Link>
        {signupHref && (
          <Link href={signupHref} className="text-brand-700 underline">
            会員登録はこちら
          </Link>
        )}
      </div>
    </form>
  );
}

export function SignupForm({
  action,
  next,
  termsHref,
  privacyHref,
}: {
  action: Action;
  next?: string;
  termsHref: string;
  privacyHref: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessages state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="お名前"
        name="displayName"
        autoComplete="name"
        required
        defaultValue={state.values?.displayName}
        error={state.fieldErrors?.displayName}
      />
      <Field
        label="メールアドレス"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        hint="貸出主センターで使うメールアドレスとは別のものをご利用ください。"
      />
      <Field
        label="パスワード"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
        hint="英字と数字を含む10文字以上"
      />
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agreeTerms" className="mt-1" required />
          <span>
            <Link href={termsHref} className="text-brand-700 underline" target="_blank">
              利用規約
            </Link>
            と
            <Link href={privacyHref} className="text-brand-700 underline" target="_blank">
              プライバシーポリシー
            </Link>
            に同意します
          </span>
        </label>
        {state.fieldErrors?.agreeTerms && (
          <p className="text-xs text-red-600">{state.fieldErrors.agreeTerms}</p>
        )}
      </div>
      <SubmitButton className="w-full" pendingLabel="登録中…">
        会員登録する
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessages state={state} />
      <Field
        label="メールアドレス"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton className="w-full">再設定のメールを送る</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessages state={state} />
      <Field
        label="新しいパスワード"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
        hint="英字と数字を含む10文字以上"
      />
      <Field
        label="新しいパスワード（確認）"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordConfirm}
      />
      <SubmitButton className="w-full">パスワードを設定する</SubmitButton>
    </form>
  );
}

export function TotpForm({
  action,
  next,
  label = "確認する",
}: {
  action: Action;
  next?: string;
  label?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessages state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="認証アプリに表示されている6桁のコード"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        error={state.fieldErrors?.code}
      />
      <SubmitButton className="w-full" pendingLabel="確認中…">
        {label}
      </SubmitButton>
    </form>
  );
}

export function TotpEnrollment({
  start,
  verify,
  next,
}: {
  start: () => Promise<{ enrollment?: { qrCode: string; secret: string }; error?: string }>;
  verify: Action;
  next?: string;
}) {
  const [enrollment, setEnrollment] = useState<{ qrCode: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!enrollment) {
    return (
      <div className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <p className="text-sm text-zinc-700">
          運営管理を使うには、認証アプリ（Google Authenticator、1Password
          など）による2段階認証の設定が必要です。
        </p>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await start();
              if (r.enrollment) setEnrollment(r.enrollment);
              else setError(r.error ?? "設定を始められませんでした。");
            })
          }
        >
          {pending ? "準備中…" : "2段階認証の設定を始める"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-700">認証アプリで QR コードを読み取ってください。</p>
      {/* Supabase が返す data URL の SVG なので next/image は使わない */}
      <img src={enrollment.qrCode} alt="2段階認証の QR コード" width={200} height={200} />
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-600">QR コードを読み取れない場合</summary>
        <p className="mt-2 break-all font-mono text-xs">{enrollment.secret}</p>
      </details>
      <TotpForm action={verify} next={next} label="設定を完了する" />
    </div>
  );
}
