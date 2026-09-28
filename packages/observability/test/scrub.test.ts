import { describe, expect, it } from "vitest";
import { scrubEvent, sentryOptions } from "../src";

describe("scrubEvent", () => {
  it("cookie・認証ヘッダー・署名・メールのリンクのトークン・利用者のメールアドレスを消す", () => {
    const e = scrubEvent({
      request: {
        cookies: { "sb-auth": "x" },
        headers: {
          Cookie: "a",
          Authorization: "Bearer x",
          "stripe-signature": "t=1",
          "user-agent": "ua",
        },
        query_string: "token_hash=abc&type=recovery",
        url: "https://thippo.example/auth/confirm?token_hash=abc&type=recovery",
        data: { password: "x" },
      },
      user: { id: "u1", email: "a@example.com", ip_address: "1.2.3.4" },
    });
    expect(e.request).toEqual({
      headers: { "user-agent": "ua" },
      query_string: "token_hash=[Filtered]&type=recovery",
      url: "https://thippo.example/auth/confirm?token_hash=[Filtered]&type=recovery",
    });
    expect(e.user).toEqual({ id: "u1" });
  });
});

describe("sentryOptions", () => {
  it("DSN がなければ送らない。個人情報は送らない", () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    expect(sentryOptions("guest")).toMatchObject({
      enabled: false,
      sendDefaultPii: false,
      initialScope: { tags: { app: "guest" } },
    });
  });
});
