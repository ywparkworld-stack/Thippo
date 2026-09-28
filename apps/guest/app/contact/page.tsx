import { Card } from "@thippo/ui";
import { ContactForm } from "./form";

export const metadata = { title: "お問い合わせ｜thippo" };

export default function ContactPage() {
  return (
    <Card className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">お問い合わせ</h1>
      <p className="text-sm text-zinc-600">
        内容を確認のうえ、担当者よりメールでご連絡いたします。
      </p>
      <ContactForm />
    </Card>
  );
}
