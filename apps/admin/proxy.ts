import { createAuthProxy } from "@thippo/auth/proxy";

// SPEC §3.1 の middleware（Next.js 16 で proxy に名前が変わった）
export const proxy = createAuthProxy("admin");

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
