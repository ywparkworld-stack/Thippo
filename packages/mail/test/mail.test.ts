import { describe, expect, it, vi } from "vitest";
import { ResendMailer, templates } from "../src";

const ctx = { guestUrl: "https://thippo.example", contactUrl: "https://thippo.example/contact" };

describe("templates", () => {
  it("本人確認の却下メールに理由と再提出の案内が入る", () => {
    const m = templates.identityRejected(ctx, {
      name: "山田",
      reason: "文字が読めません",
      backSideRequested: true,
    });
    expect(m.subject).toContain("再提出");
    expect(m.text).toContain("山田 様");
    expect(m.text).toContain("文字が読めません");
    expect(m.text).toContain("表面と裏面");
    expect(m.text).toContain("https://thippo.example/mypage/identity");
    expect(m.text).toContain("https://thippo.example/contact");
  });

  it("両面を求めないときは裏面の案内を入れない", () => {
    const m = templates.identityRejected(ctx, {
      name: "山田",
      reason: "期限切れ",
      backSideRequested: false,
    });
    expect(m.text).not.toContain("裏面");
  });
});

describe("ResendMailer", () => {
  it("Resend の API に送り、Idempotency-Key を付ける", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }),
    );
    const mailer = new ResendMailer(
      "re_key",
      "thippo <no-reply@thippo.example>",
      fetchMock as unknown as typeof fetch,
    );
    const r = await mailer.send({
      to: "a@example.com",
      subject: "s",
      text: "t",
      idempotencyKey: "k1",
    });
    expect(r).toEqual({ id: "msg_1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("k1");
    expect(JSON.parse(init.body as string)).toMatchObject({
      to: ["a@example.com"],
      subject: "s",
      text: "t",
    });
  });

  it("失敗したら例外にする", async () => {
    const fetchMock = vi.fn(async () => new Response("bad", { status: 422 }));
    const mailer = new ResendMailer("k", "f", fetchMock as unknown as typeof fetch);
    await expect(mailer.send({ to: "a@example.com", subject: "s", text: "t" })).rejects.toThrow(
      /422/,
    );
  });
});

describe("予約確定のメール", () => {
  it("注文番号・予約の内容・金額が入る", () => {
    const m = templates.bookingConfirmedGuest(ctx, {
      name: "山田",
      orderNumber: "T-00000001",
      total: "¥3,000",
      lines: [
        {
          spaceName: "会議室A",
          when: "2026/10/01(木) 10:00〜11:30",
          address: "東京都",
          amount: "¥3,000",
        },
      ],
    });
    expect(m.subject).toContain("T-00000001");
    expect(m.text).toContain("・会議室A\n  2026/10/01(木) 10:00〜11:30");
    expect(m.text).toContain("¥3,000");
  });
});

describe("mailModeFromEnv（付録 D39）", () => {
  it("Resend のキーがあれば Resend、開発・テストはログ、それ以外は手作業", async () => {
    const { mailModeFromEnv } = await import("../src");
    expect(mailModeFromEnv({ RESEND_API_KEY: "k", MAIL_FROM: "f", APP_ENV: "staging" })).toBe(
      "resend",
    );
    expect(mailModeFromEnv({ APP_ENV: "development" })).toBe("console");
    expect(mailModeFromEnv({ APP_ENV: "staging" })).toBe("manual");
    expect(mailModeFromEnv({ APP_ENV: "production" })).toBe("manual");
  });
});
