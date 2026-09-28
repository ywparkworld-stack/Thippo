import type { NextRequest } from "next/server";
import { handleEmailConfirm } from "@thippo/auth/confirm";

export async function GET(request: NextRequest) {
  return handleEmailConfirm("guest", request);
}
