import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * サーバー（Server Components・Route Handlers・Server Actions・middleware）用のクライアント。
 * ログイン中の利用者の権限で動き、RLS が効く。cookie の読み書きは呼び出し側（各アプリ）が渡す。
 */
export function createSupabaseServerClient(cookies: CookieMethodsServer) {
  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), { cookies });
}
