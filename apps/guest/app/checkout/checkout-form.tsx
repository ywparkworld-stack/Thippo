"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button, Notice } from "@thippo/ui";
import { completeStubPaymentAction, startPaymentAction } from "../actions/checkout";

type FormError = { message: string; backToCart: boolean } | null;

/**
 * Stripe Payment Element で支払う（SPEC §6・付録 D20: カードのみ）。
 * 「支払う」を押すと、サーバーで注文と PaymentIntent を作ってから決済を確定する。
 * テスト用の支払いモード（付録 D37）では Stripe を使わず、注文を作ってそのまま支払い済みにする。
 */
export function CheckoutForm({
  total,
  publishableKey,
  stub,
}: {
  total: number;
  publishableKey: string;
  stub: boolean;
}) {
  const stripePromise = useMemo(
    () => (!stub && publishableKey ? loadStripe(publishableKey, { locale: "ja" }) : null),
    [publishableKey, stub],
  );
  if (stub) return <StubPaymentForm total={total} />;
  if (!stripePromise) return <Notice tone="error">決済の設定がありません。</Notice>;
  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: total,
        currency: "jpy",
        paymentMethodTypes: ["card"],
        locale: "ja",
      }}
    >
      <PaymentForm total={total} />
    </Elements>
  );
}

function PaymentForm({ total }: { total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const agreements = useAgreements();
  const [error, setError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || pending) return;
    setError(null);
    setPending(true);
    try {
      const submitted = await elements.submit();
      if (submitted.error) {
        setError({
          message: submitted.error.message ?? "カード情報をご確認ください。",
          backToCart: false,
        });
        return;
      }
      const started = await startPaymentAction({ ...agreements.values, displayedTotal: total });
      if (!started.ok) {
        setError({ message: started.message, backToCart: started.backToCart });
        return;
      }
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: started.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/complete?order=${started.orderId}`,
        },
      });
      // ここに来るのは失敗したときだけ（成功すると return_url に移動する）
      if (confirmError) {
        setError({
          message: confirmError.message ?? "お支払いに失敗しました。",
          backToCart: false,
        });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement />
      <FormFooter
        agreements={agreements}
        error={error}
        disabled={!stripe || pending || !agreements.ok}
        pending={pending}
      />
    </form>
  );
}

/** テスト用の支払いモード（付録 D37）。カード情報は入力せず、支払いが成功したものとして扱う */
function StubPaymentForm({ total }: { total: number }) {
  const agreements = useAgreements();
  const [error, setError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const started = await startPaymentAction({ ...agreements.values, displayedTotal: total });
      if (!started.ok) {
        setError({ message: started.message, backToCart: started.backToCart });
        return;
      }
      const completed = await completeStubPaymentAction(started.orderId);
      if (!completed.ok) {
        setError({ message: completed.message, backToCart: false });
        return;
      }
      window.location.assign(`/checkout/complete?order=${started.orderId}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      <Notice tone="info">
        現在はテスト用の支払いモードです。カード情報の入力はなく、実際の請求は行われません。
      </Notice>
      <FormFooter
        agreements={agreements}
        error={error}
        disabled={pending || !agreements.ok}
        pending={pending}
      />
    </form>
  );
}

function useAgreements() {
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeCancelPolicy, setAgreeCancelPolicy] = useState(false);
  return {
    values: { agreeTerms, agreeCancelPolicy },
    ok: agreeTerms && agreeCancelPolicy,
    setAgreeTerms,
    setAgreeCancelPolicy,
  };
}

function FormFooter({
  agreements,
  error,
  disabled,
  pending,
}: {
  agreements: ReturnType<typeof useAgreements>;
  error: FormError;
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreements.values.agreeTerms}
          onChange={(e) => agreements.setAgreeTerms(e.target.checked)}
          className="mt-1"
        />
        <span>
          <Link href="/terms" target="_blank" className="text-brand-700 underline">
            利用規約
          </Link>
          に同意します
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreements.values.agreeCancelPolicy}
          onChange={(e) => agreements.setAgreeCancelPolicy(e.target.checked)}
          className="mt-1"
        />
        <span>
          <Link href="/cancel-policy" target="_blank" className="text-brand-700 underline">
            キャンセル規定
          </Link>
          に同意します
        </span>
      </label>
      {error && (
        <Notice tone="error">
          {error.message}
          {error.backToCart && (
            <Link href="/cart" className="ml-1 underline">
              予約カゴに戻る
            </Link>
          )}
        </Notice>
      )}
      <Button type="submit" className="w-full" disabled={disabled}>
        {pending ? "処理中…" : "支払う"}
      </Button>
      <p className="text-xs text-zinc-500">お支払い手続きの有効期限は15分です。</p>
    </>
  );
}
