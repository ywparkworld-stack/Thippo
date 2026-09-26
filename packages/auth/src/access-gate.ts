import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/**
 * 運営管理の前段のアクセス制限（SPEC §3.2、docs/admin-access.md）。
 *
 * ADMIN_ACCESS_GATE
 * - "cloudflare": Cloudflare Access が付ける JWT（Cf-Access-Jwt-Assertion）を検証する。
 *   Cloudflare を通らずに Vercel の URL へ直接来たリクエストは JWT がないため拒否される。
 * - "vercel": Vercel の Password Protection / Trusted IPs で守る（アプリ側では確かめない）。
 * - "none": ローカル開発のみ。staging・production では拒否する（設定漏れで無防備にならないように）。
 */
export type AccessGateMode = "cloudflare" | "vercel" | "none";

export interface AccessGateConfig {
  mode: AccessGateMode;
  appEnv: string;
  cloudflare?: { teamDomain: string; audience: string };
}

export function readAccessGateConfig(env: NodeJS.ProcessEnv = process.env): AccessGateConfig {
  const mode = (env.ADMIN_ACCESS_GATE ?? "cloudflare") as AccessGateMode;
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN;
  const audience = env.CF_ACCESS_AUD;
  return {
    mode,
    appEnv: env.APP_ENV ?? "production",
    cloudflare: teamDomain && audience ? { teamDomain, audience } : undefined,
  };
}

export type GateResult = { ok: true; email?: string } | { ok: false; reason: string };

const jwksCache = new Map<string, JWTVerifyGetKey>();

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

export async function checkAccessGate(
  headers: Headers,
  config: AccessGateConfig,
  jwks?: JWTVerifyGetKey,
): Promise<GateResult> {
  switch (config.mode) {
    case "vercel":
      return { ok: true };
    case "none":
      return config.appEnv === "development"
        ? { ok: true }
        : { ok: false, reason: "ADMIN_ACCESS_GATE=none is only allowed in development" };
    case "cloudflare": {
      if (!config.cloudflare) return { ok: false, reason: "Cloudflare Access is not configured" };
      const token = headers.get("cf-access-jwt-assertion");
      if (!token) return { ok: false, reason: "missing Cloudflare Access token" };
      try {
        const { teamDomain, audience } = config.cloudflare;
        const { payload } = await jwtVerify(token, jwks ?? remoteJwks(teamDomain), {
          issuer: `https://${teamDomain}`,
          audience,
        });
        return { ok: true, email: typeof payload.email === "string" ? payload.email : undefined };
      } catch {
        return { ok: false, reason: "invalid Cloudflare Access token" };
      }
    }
    default:
      return { ok: false, reason: "unknown ADMIN_ACCESS_GATE" };
  }
}
