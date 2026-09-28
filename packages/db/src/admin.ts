import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { required, supabaseUrl } from "./env";

/**
 * service role のクライアント。RLS を無視するため、サーバー側で権限を確かめたあとにだけ使う。
 * ブラウザに渡るコードから import してはいけない（server-only で防ぐ）。
 */
export function createSupabaseServiceClient() {
  return createClient<Database>(
    supabaseUrl(),
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
