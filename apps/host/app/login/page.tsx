import { loginErrorMessage, safeNextPath } from "@thippo/auth";
import { LoginForm } from "@thippo/auth/forms";
import { Card } from "@thippo/ui";
import { signInAction } from "../actions/auth";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? safeNextPath(searchParams.next) : undefined;
  return (
    <Card className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">貸出主センターにログイン</h1>
      <LoginForm action={signInAction} next={next} notice={loginErrorMessage(searchParams.error)} />
    </Card>
  );
}
