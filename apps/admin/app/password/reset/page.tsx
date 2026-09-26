import { requireAppSession } from "@thippo/auth/server";
import { ResetPasswordForm } from "@thippo/auth/forms";
import { Card } from "@thippo/ui";
import { updatePasswordAction } from "../../actions/auth";

export default async function ResetPasswordPage() {
  await requireAppSession("admin", "/password/reset");
  return (
    <Card className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">新しいパスワードの設定</h1>
      <ResetPasswordForm action={updatePasswordAction} />
    </Card>
  );
}
