import { ForgotPasswordForm } from "@thippo/auth/forms";
import { Card } from "@thippo/ui";
import { requestPasswordResetAction } from "../../actions/auth";

export default function ForgotPasswordPage() {
  return (
    <Card className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">パスワードの再設定</h1>
      <p className="text-sm text-zinc-600">
        ご登録のメールアドレスに、パスワード再設定のリンクをお送りします。
      </p>
      <ForgotPasswordForm action={requestPasswordResetAction} />
    </Card>
  );
}
