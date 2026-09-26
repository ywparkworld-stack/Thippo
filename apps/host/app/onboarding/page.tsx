import { onboardingState } from "@thippo/payments";
import { Button, Card, Notice } from "@thippo/ui";
import { openStripeDashboardAction, startStripeOnboardingAction } from "../actions/onboarding";
import { requireHost } from "../lib/host";
import { HostProfileForm } from "./profile-form";

const STATE_TEXT = {
  not_started: "未登録です。入金先の登録を行ってください。",
  in_progress: "登録の途中です。続きから登録してください。",
  pending_verification: "登録内容を Stripe が確認しています。完了までしばらくお待ちください。",
  complete: "登録が完了しています。スペースを公開できます。",
} as const;

export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const { host } = await requireHost("/onboarding");
  const searchParams = await props.searchParams;
  const state = onboardingState(host);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {searchParams.stripe === "returned" && state !== "complete" && (
        <Notice tone="info">Stripe の登録画面から戻りました。{STATE_TEXT[state]}</Notice>
      )}
      <Card className="space-y-4">
        <h1 className="text-xl font-bold">会社情報</h1>
        <HostProfileForm
          companyName={host.company_name}
          invoiceRegistrationNumber={host.invoice_registration_number ?? ""}
          address={host.address ?? ""}
          phone={host.phone ?? ""}
        />
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-bold">入金先の登録（Stripe）</h2>
        <p className="text-sm text-zinc-700">
          売上の受け取りには Stripe での登録が必要です。法人・個人事業主のどちらでも登録できます。
          登録が完了するまで、スペースは公開できません。売上は毎月23日に入金されます。
        </p>
        <Notice tone={state === "complete" ? "success" : "warning"}>{STATE_TEXT[state]}</Notice>
        {state !== "complete" && state !== "pending_verification" && (
          <form action={startStripeOnboardingAction}>
            <Button type="submit">
              {state === "not_started" ? "Stripe で登録を始める" : "登録を続ける"}
            </Button>
          </form>
        )}
        {host.details_submitted && (
          <form action={openStripeDashboardAction}>
            <Button type="submit" variant="secondary">
              Stripe の管理画面を開く
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
