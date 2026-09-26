import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { checkAccessGate, readAccessGateConfig, type AccessGateConfig } from "../src/access-gate";

const teamDomain = "thippo.cloudflareaccess.com";
const audience = "aud-123";
let privateKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

const cf: AccessGateConfig = {
  mode: "cloudflare",
  appEnv: "production",
  cloudflare: { teamDomain, audience },
};

const token = (over: { iss?: string; aud?: string; exp?: string } = {}) =>
  new SignJWT({ email: "ops@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(over.iss ?? `https://${teamDomain}`)
    .setAudience(over.aud ?? audience)
    .setIssuedAt()
    .setExpirationTime(over.exp ?? "5m")
    .sign(privateKey);

const headersWith = (t?: string) => new Headers(t ? { "cf-access-jwt-assertion": t } : {});

describe("checkAccessGate（Cloudflare Access）", () => {
  it("正しい JWT なら通す", async () => {
    expect(await checkAccessGate(headersWith(await token()), cf, jwks)).toEqual({
      ok: true,
      email: "ops@example.com",
    });
  });

  it("JWT がない（Vercel の URL に直接来た）なら拒否", async () => {
    expect(await checkAccessGate(headersWith(), cf, jwks)).toMatchObject({ ok: false });
  });

  it("audience・issuer が違う、期限切れ、署名が違う JWT は拒否", async () => {
    expect(
      await checkAccessGate(headersWith(await token({ aud: "other" })), cf, jwks),
    ).toMatchObject({ ok: false });
    expect(
      await checkAccessGate(headersWith(await token({ iss: "https://evil.example" })), cf, jwks),
    ).toMatchObject({
      ok: false,
    });
    expect(await checkAccessGate(headersWith(await token({ exp: "-1m" })), cf, jwks)).toMatchObject(
      { ok: false },
    );
    const other = await generateKeyPair("RS256");
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(`https://${teamDomain}`)
      .setAudience(audience)
      .setExpirationTime("5m")
      .sign(other.privateKey);
    expect(await checkAccessGate(headersWith(forged), cf, jwks)).toMatchObject({ ok: false });
  });

  it("設定がなければ拒否（無防備にしない）", async () => {
    expect(
      await checkAccessGate(
        headersWith(await token()),
        { mode: "cloudflare", appEnv: "production" },
        jwks,
      ),
    ).toMatchObject({
      ok: false,
    });
  });
});

describe("checkAccessGate（その他のモード）", () => {
  it("none は development でだけ通す", async () => {
    expect(await checkAccessGate(headersWith(), { mode: "none", appEnv: "development" })).toEqual({
      ok: true,
    });
    expect(await checkAccessGate(headersWith(), { mode: "none", appEnv: "staging" })).toMatchObject(
      { ok: false },
    );
    expect(
      await checkAccessGate(headersWith(), { mode: "none", appEnv: "production" }),
    ).toMatchObject({ ok: false });
  });

  it("vercel はアプリ側では確かめない", async () => {
    expect(await checkAccessGate(headersWith(), { mode: "vercel", appEnv: "production" })).toEqual({
      ok: true,
    });
  });

  it("既定は cloudflare・production（設定漏れで無防備にならない）", () => {
    expect(readAccessGateConfig({} as NodeJS.ProcessEnv)).toEqual({
      mode: "cloudflare",
      appEnv: "production",
      cloudflare: undefined,
    });
  });
});
