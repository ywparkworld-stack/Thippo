import { safeNextPath } from "@thippo/auth";
import { SignupForm } from "@thippo/auth/forms";
import { Card } from "@thippo/ui";
import Link from "next/link";
import { signUpAction } from "../actions/auth";

export default async function SignupPage(props: PageProps<"/signup">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? safeNextPath(searchParams.next) : undefined;
  return (
    <Card className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">会員登録</h1>
      <SignupForm action={signUpAction} next={next} termsHref="/terms" privacyHref="/privacy" />
      <p className="text-sm">
        登録済みの方は
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-brand-700 underline"
        >
          ログイン
        </Link>
      </p>
    </Card>
  );
}
