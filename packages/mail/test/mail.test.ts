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
