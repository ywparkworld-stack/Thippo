"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

/** フォームの送信ボタン。送信中は押せないようにする（二重送信の防止）。 */
export function SubmitButton({
  children,
  pendingLabel = "送信中…",
  variant,
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      variant={variant}
      className={className}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
