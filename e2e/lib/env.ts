export const env = {
  guestUrl: process.env.E2E_GUEST_URL ?? "http://localhost:3000",
  hostUrl: process.env.E2E_HOST_URL ?? "http://localhost:3001",
  adminUrl: process.env.E2E_ADMIN_URL ?? "http://localhost:3002",
  /** supabase start のデータベース */
  dbUrl: process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  /** supabase start のメール（Mailpit） */
  mailUrl: process.env.E2E_MAIL_URL ?? "http://127.0.0.1:54324",
  /** アプリと同じ決済モード（付録 D37）。stub なら Stripe を使わない */
  stub:
    (process.env.PAYMENTS_MODE || (process.env.STRIPE_SECRET_KEY ? "stripe" : "stub"))
      .trim()
      .toLowerCase() === "stub",
  /** Stripe のテストモードで作った、決済・入金ができる連結アカウント（stub のときは不要） */
  connectedAccountId:
    process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID ||
    ((process.env.PAYMENTS_MODE || (process.env.STRIPE_SECRET_KEY ? "stripe" : "stub"))
      .trim()
      .toLowerCase() === "stub"
      ? "acct_stub_e2e"
      : ""),
  adminEmail: "e2e-admin@example.test",
  adminPassword: "E2eAdminPass123",
};
