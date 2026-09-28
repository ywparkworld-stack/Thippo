import { defineConfig, devices } from "@playwright/test";

/**
 * E2E テスト（SPEC §14・付録 D35）。ローカルの Supabase（supabase start）・Stripe のテストモード
 * （または PAYMENTS_MODE=stub のテスト用の支払いモード。付録 D37）・
 * 3アプリ（next start）が動いている前提で実行する。CI の手順は .github/workflows/e2e.yml。
 */
export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 5 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./lib/global-setup.ts",
  use: {
    ...devices["Desktop Chrome"],
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
