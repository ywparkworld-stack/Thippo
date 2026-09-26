"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button, Notice } from "@thippo/ui";
import { startPaymentAction } from "../actions/checkout";

/**
 * Stripe Payment Element で支払う（SPEC §6・付録 D20: カードのみ）。
 * 「支払う」を押すと、サーバーで注文と PaymentIntent を作ってから決済を確定する。
 */
export function CheckoutForm({ total, publishableKey }: { total: number; publishableKey: string }) {
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey, { locale: "ja" }) : null),
    [publishableKey],
  );
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
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeCancelPolicy, setAgreeCancelPolicy] = useState(false);
  const [error, setError] = useState<{ message: string; backToCart: boolean } | null>(null);
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
      const started = await startPaymentAction({
        agreeTerms,
        agreeCancelPolicy,
        displayedTotal: total,
      });
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
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreeTerms}
          onChange={(e) => setAgreeTerms(e.target.checked)}
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
          checked={agreeCancelPolicy}
          onChange={(e) => setAgreeCancelPolicy(e.target.checked)}
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
      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || pending || !agreeTerms || !agreeCancelPolicy}
      >
        {pending ? "処理中…" : "支払う"}
      </Button>
      <p className="text-xs text-zinc-500">お支払い手続きの有効期限は15分です。</p>
    </form>
  );
}
