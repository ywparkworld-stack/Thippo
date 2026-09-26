import { describe, expect, it } from "vitest";
import { decideAccess, safeNextPath, type SessionInfo } from "../src";

const session = (over: Partial<SessionInfo> = {}): SessionInfo => ({
  userId: "u1",
  role: "guest",
  status: "active",
  deleted: false,
  aal: "aal1",
  hasVerifiedFactor: false,
  ...over,
});

describe("decideAccess: 利用者サイト", () => {
  it("公開ページは未ログインでも開ける", () => {
    expect(decideAccess("guest", "/", "", null)).toEqual({ type: "allow" });
    expect(decideAccess("guest", "/spaces/abc", "", null)).toEqual({ type: "allow" });
    expect(decideAccess("guest", "/login", "", null)).toEqual({ type: "allow" });
  });

  it("マイページ・購入手続きは未ログインならログイン画面へ（戻り先付き）", () => {
    expect(decideAccess("guest", "/mypage/orders", "?page=2", null)).toEqual({
      type: "redirect",
      to: "/login?next=%2Fmypage%2Forders%3Fpage%3D2",
    });
    expect(decideAccess("guest", "/checkout", "", null)).toMatchObject({
      to: "/login?next=%2Fcheckout",
    });
  });

  it("貸出主・運営のアカウントは利用者サイトに入れない（セッションを破棄）", () => {
    for (const role of ["host", "admin"] as const) {
      expect(decideAccess("guest", "/", "", session({ role }))).toEqual({
        type: "redirect",
        to: "/login?error=forbidden",
        signOut: true,
      });
    }
  });

  it("停止中のアカウントはログイン画面へ", () => {
    expect(decideAccess("guest", "/mypage", "", session({ status: "suspended" }))).toEqual({
      type: "redirect",
      to: "/login?error=suspended",
      signOut: true,
    });
  });

  it("退会済み（プロフィールなし）はログイン画面へ", () => {
    expect(decideAccess("guest", "/", "", session({ deleted: true }))).toMatchObject({
      signOut: true,
    });
    expect(decideAccess("guest", "/", "", session({ role: null }))).toMatchObject({
      signOut: true,
    });
  });

  it("ログイン済みでログイン画面・会員登録画面を開くとトップへ", () => {
    expect(decideAccess("guest", "/login", "", session())).toEqual({ type: "redirect", to: "/" });
    expect(decideAccess("guest", "/signup", "", session())).toEqual({ type: "redirect", to: "/" });
    expect(decideAccess("guest", "/mypage", "", session())).toEqual({ type: "allow" });
  });
});

describe("decideAccess: 貸出主センター", () => {
  it("ログイン画面・メールのリンク・パスワード再設定の依頼以外はログインが必要", () => {
    expect(decideAccess("host", "/", "", null)).toEqual({ type: "redirect", to: "/login" });
    expect(decideAccess("host", "/spaces", "", null)).toMatchObject({
      to: "/login?next=%2Fspaces",
    });
    expect(decideAccess("host", "/login", "", null)).toEqual({ type: "allow" });
    expect(decideAccess("host", "/auth/confirm", "?token_hash=x", null)).toEqual({ type: "allow" });
    expect(decideAccess("host", "/password/forgot", "", null)).toEqual({ type: "allow" });
    expect(decideAccess("host", "/password/reset", "", null)).toMatchObject({ type: "redirect" });
  });

  it("利用者のアカウントは貸出主センターに入れない（付録 D6）", () => {
    expect(decideAccess("host", "/", "", session({ role: "guest" }))).toMatchObject({
      to: "/login?error=forbidden",
      signOut: true,
    });
    expect(decideAccess("host", "/", "", session({ role: "host" }))).toEqual({ type: "allow" });
  });

  it("「/loginx」のような似たパスは公開扱いにしない", () => {
    expect(decideAccess("host", "/loginx", "", null)).toMatchObject({ type: "redirect" });
  });
});

describe("decideAccess: 運営管理", () => {
  const admin = (over: Partial<SessionInfo> = {}) => session({ role: "admin", ...over });

  it("2段階認証を設定していない admin は設定画面以外を開けない", () => {
    expect(decideAccess("admin", "/", "", admin())).toEqual({
      type: "redirect",
      to: "/mfa/enroll",
    });
    expect(decideAccess("admin", "/audit-logs", "", admin())).toEqual({
      type: "redirect",
      to: "/mfa/enroll?next=%2Faudit-logs",
    });
    expect(decideAccess("admin", "/mfa/enroll", "", admin())).toEqual({ type: "allow" });
    expect(decideAccess("admin", "/mfa/verify", "", admin())).toMatchObject({ to: "/mfa/enroll" });
    expect(decideAccess("admin", "/password/reset", "", admin())).toMatchObject({
      type: "redirect",
    });
  });

  it("設定済みで未確認（aal1）の admin は確認画面へ", () => {
    expect(decideAccess("admin", "/", "", admin({ hasVerifiedFactor: true }))).toEqual({
      type: "redirect",
      to: "/mfa/verify",
    });
    expect(decideAccess("admin", "/mfa/verify", "", admin({ hasVerifiedFactor: true }))).toEqual({
      type: "allow",
    });
    expect(
      decideAccess("admin", "/mfa/enroll", "", admin({ hasVerifiedFactor: true })),
    ).toMatchObject({
      to: "/mfa/verify",
    });
  });

  it("aal2 の admin は画面を開ける。2段階認証の画面・ログイン画面からはトップへ", () => {
    const ok = admin({ aal: "aal2", hasVerifiedFactor: true });
    expect(decideAccess("admin", "/", "", ok)).toEqual({ type: "allow" });
    expect(decideAccess("admin", "/mfa/verify", "", ok)).toEqual({ type: "redirect", to: "/" });
    expect(decideAccess("admin", "/login", "", ok)).toEqual({ type: "redirect", to: "/" });
  });

  it("admin 以外のアカウントは運営管理に入れない", () => {
    for (const role of ["guest", "host"] as const) {
      expect(decideAccess("admin", "/", "", session({ role, aal: "aal2" }))).toMatchObject({
        to: "/login?error=forbidden",
        signOut: true,
      });
    }
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/mypage", "/mypage"],
    ["/checkout?x=1#a", "/checkout?x=1#a"],
    ["https://evil.example/", "/"],
    ["//evil.example/", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["", "/"],
    [undefined, "/"],
    ["/a\nb", "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
