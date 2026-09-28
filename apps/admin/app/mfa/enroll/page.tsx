import { safeNextPath } from "@thippo/auth";
import { TotpEnrollment } from "@thippo/auth/forms";
import { Card } from "@thippo/ui";
import { startEnrollmentAction, verifyEnrollmentAction } from "../../actions/mfa";

export default async function EnrollPage(props: PageProps<"/mfa/enroll">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? safeNextPath(searchParams.next) : undefined;
  return (
    <Card className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">2段階認証の設定</h1>
      <TotpEnrollment start={startEnrollmentAction} verify={verifyEnrollmentAction} next={next} />
    </Card>
  );
}
