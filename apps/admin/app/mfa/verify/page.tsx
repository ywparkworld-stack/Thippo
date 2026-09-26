import { safeNextPath } from "@thippo/auth";
import { TotpForm } from "@thippo/auth/forms";
import { Card } from "@thippo/ui";
import { verifyTotpAction } from "../../actions/mfa";

export default async function VerifyPage(props: PageProps<"/mfa/verify">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? safeNextPath(searchParams.next) : undefined;
  return (
    <Card className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">2段階認証</h1>
      <TotpForm action={verifyTotpAction} next={next} />
    </Card>
  );
}
