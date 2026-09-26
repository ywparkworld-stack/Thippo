export const env = {
  guestUrl: process.env.E2E_GUEST_URL ?? "http://localhost:3000",
  hostUrl: process.env.E2E_HOST_URL ?? "http://localhost:3001",
  adminUrl: process.env.E2E_ADMIN_URL ?? "http://localhost:3002",
  /** supabase start のデータベース */
  dbUrl: process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  /** supabase start のメール（Mailpit） */
  mailUrl: process.env.E2E_MAIL_URL ?? "http://127.0.0.1:54324",
  /** Stripe のテストモードで作った、決済・入金ができる連結アカウント */
  connectedAccountId: process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID ?? "",
  adminEmail: "e2e-admin@example.test",
  adminPassword: "E2eAdminPass123",
};
