import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { env } from "../lib/env";
import { firstLink, waitForMail, waitForNotification } from "../lib/mail";
import { totp } from "../lib/totp";

/**
 * 会員登録 → 本人確認 → 承認 → 予約 → 支払い（Stripe のテストカード）→ キャンセル → 返金（SPEC §14）
 */
const state = () =>
  JSON.parse(readFileSync(join(import.meta.dirname, "..", ".e2e-state.json"), "utf8")) as {
    spaceId: string;
    spaceName: string;
  };

// 1x1 の JPEG
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

async function loginAsAdmin(page: Page) {
  await page.goto(`${env.adminUrl}/login`);
  await page.getByLabel("メールアドレス").fill(env.adminEmail);
  await page.getByLabel("パスワード").fill(env.adminPassword);
  await page.getByRole("button", { name: "ログイン" }).click();
  // 初回は2段階認証の設定、2回目以降は確認
  await page.waitForURL(/\/mfa\/(enroll|verify)/);
  if (page.url().includes("/mfa/enroll")) {
    await page.getByRole("button", { name: "2段階認証の設定を始める" }).click();
    await page.getByText("QR コードを読み取れない場合").click();
    const secret = (await page.locator("details p.font-mono").innerText()).trim();
    await page.getByLabel("認証アプリに表示されている6桁のコード").fill(totp(secret));
    await page.getByRole("button", { name: "設定を完了する" }).click();
    test.info().annotations.push({ type: "totp-secret", description: "enrolled" });
    process.env.E2E_ADMIN_TOTP_SECRET = secret;
  } else {
    await page
      .getByLabel("認証アプリに表示されている6桁のコード")
      .fill(totp(process.env.E2E_ADMIN_TOTP_SECRET ?? ""));
    await page.getByRole("button", { name: "確認する" }).click();
  }
  await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible();
}

test("会員登録から返金まで", async ({ browser }) => {
  const email = `e2e-guest-${Date.now()}@example.test`;
  const password = "GuestPass1234";
  const guest = await (await browser.newContext()).newPage();

  // 会員登録とメールアドレスの確認（Supabase Auth のメールは Mailpit に届く）
  await guest.goto(`${env.guestUrl}/signup`);
  await guest.getByLabel("お名前").fill("山田 太郎");
  await guest.getByLabel("メールアドレス").fill(email);
  await guest.getByLabel("パスワード").fill(password);
  await guest.getByRole("checkbox").check();
  await guest.getByRole("button", { name: "会員登録する" }).click();
  await expect(guest.getByRole("heading", { name: "確認メールをお送りしました" })).toBeVisible();
  const confirmMail = await waitForMail(email, "メールアドレスの確認");
  await guest.goto(firstLink(confirmMail, "/auth/confirm"));

  // ログインして本人確認書類を提出
  if (!guest.url().includes("/mypage")) {
    await guest.goto(`${env.guestUrl}/login`);
    await guest.getByLabel("メールアドレス").fill(email);
    await guest.getByLabel("パスワード").fill(password);
    await guest.getByRole("button", { name: "ログイン" }).click();
  }
  await guest.goto(`${env.guestUrl}/mypage/identity`);
  await guest.getByLabel("書類の種類").selectOption("drivers_license");
  await guest
    .getByLabel("表面の画像")
    .setInputFiles({ name: "license.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await guest.getByRole("button", { name: "提出する" }).click();
  await expect(guest.getByText("本人確認書類を提出しました")).toBeVisible();

  // 運営が承認する
  const admin = await (await browser.newContext()).newPage();
  await loginAsAdmin(admin);
  await admin.goto(`${env.adminUrl}/identity`);
  await admin.getByRole("row", { name: email }).getByRole("link", { name: "審査する" }).click();
  await admin.getByRole("button", { name: "承認して通知する" }).click();
  await expect(admin.getByText("承認しました")).toBeVisible();
  await waitForNotification(email, "identityApproved");

  // 予約：明日の 10:00〜11:00 をカゴに入れる
  const { spaceId } = state();
  const tomorrow = new Date(Date.now() + 9 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
  await guest.goto(`${env.guestUrl}/spaces/${spaceId}?date=${tomorrow}`);
  await guest.getByRole("button", { name: /^10:00/ }).click();
  await guest.getByRole("button", { name: /^10:30/ }).click();
  await guest.getByRole("button", { name: "予約カゴに入れる" }).click();
  await expect(guest.getByText("予約カゴに入れました")).toBeVisible();

  // 購入手続き：Stripe のテストカードで支払う
  await guest.goto(`${env.guestUrl}/checkout`);
  const card = guest.frameLocator('iframe[title*="Secure payment input frame"]').first();
  await card.getByLabel(/Card number|カード番号/).fill("4242424242424242");
  await card.getByLabel(/Expiration|有効期限/).fill("12 / 34");
  await card.getByLabel(/Security code|セキュリティコード/).fill("123");
  const country = card.getByLabel(/Country|国/);
  if (await country.count()) await country.selectOption("JP");
  await guest.getByRole("checkbox", { name: /利用規約/ }).check();
  await guest.getByRole("checkbox", { name: /キャンセル規定/ }).check();
  await guest.getByRole("button", { name: "支払う" }).click();
  await guest.waitForURL(/\/checkout\/complete/, { timeout: 120_000 });
  await expect(guest.getByRole("heading", { name: "ご予約が確定しました" })).toBeVisible({
    timeout: 120_000,
  });
  const orderNumber = await guest.locator("dd.font-mono").innerText();
  await waitForNotification(email, "bookingConfirmedGuest");

  // キャンセル（前日なので全額返金）
  await guest.goto(`${env.guestUrl}/mypage/orders`);
  await guest.getByRole("link", { name: new RegExp(orderNumber) }).click();
  await guest.getByRole("link", { name: "キャンセルする" }).click();
  await expect(
    guest.getByText("過去24時間で1回目のキャンセルです。6回目以降は返金されません。"),
  ).toBeVisible();
  await expect(guest.getByText("¥2,000").first()).toBeVisible();
  await guest.getByRole("checkbox").check();
  guest.once("dialog", (d) => d.accept());
  await guest.getByRole("button", { name: "キャンセルする" }).click();
  await expect(guest.getByText("キャンセルしました")).toBeVisible();

  // 返金の完了（Webhook の charge.refunded）
  await expect(async () => {
    await guest.reload();
    await expect(guest.getByText("返金 ¥2,000（完了）")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 120_000 });
  await waitForNotification(email, "refundCompleted");
});
