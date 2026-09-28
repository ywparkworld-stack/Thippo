import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** ブラウザ用のクライアント（ログイン中の利用者の権限。RLS が効く）。 */
export function createSupabaseBrowserClient() {
  // NEXT_PUBLIC_ の値はビルド時に埋め込まれるため、process.env を直接参照する
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
