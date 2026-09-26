import { Card } from "@thippo/ui";

export default function CheckEmailPage() {
  return (
    <Card className="mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-bold">確認メールをお送りしました</h1>
      <p className="text-sm text-zinc-700">
        ご入力のメールアドレスに確認のメールをお送りしました。メールのリンクを開いて、登録を完了してください。
      </p>
      <p className="text-sm text-zinc-500">
        メールが届かない場合は、迷惑メールフォルダをご確認のうえ、しばらくしてからもう一度お試しください。
      </p>
    </Card>
  );
}
