import { describe, expect, it } from "vitest";
import {
  fieldErrors,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  totpCodeSchema,
} from "../src";

describe("auth validation", () => {
  it("メールアドレスは前後の空白を除き、小文字にする", () => {
    const r = loginSchema.parse({ email: "  Foo@Example.COM ", password: "x" });
    expect(r.email).toBe("foo@example.com");
  });

  it("会員登録は規約への同意とパスワードの強さを求める", () => {
    const r = signupSchema.safeParse({
      email: "a@example.com",
      password: "short",
      displayName: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = fieldErrors(r.error);
      expect(Object.keys(e).sort()).toEqual(["agreeTerms", "displayName", "password"]);
    }
    expect(
      signupSchema.safeParse({
        email: "a@example.com",
        password: "abcdefgh12",
        displayName: "山田",
        agreeTerms: "on",
      }).success,
    ).toBe(true);
    expect(
      signupSchema.safeParse({
        email: "a@example.com",
        password: "abcdefghij",
        displayName: "山田",
        agreeTerms: "on",
      }).success,
    ).toBe(false);
  });

  it("確認用パスワードが一致しないとエラー", () => {
    const r = resetPasswordSchema.safeParse({
      password: "abcdefgh12",
      passwordConfirm: "abcdefgh13",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)).toHaveProperty("passwordConfirm");
  });

  it("TOTP は6桁の数字", () => {
    expect(totpCodeSchema.safeParse({ code: " 123456 " }).success).toBe(true);
    expect(totpCodeSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(totpCodeSchema.safeParse({ code: "12345a" }).success).toBe(false);
  });
});
