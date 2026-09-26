import Link from "next/link";
import { createClient, loadSession } from "@thippo/auth/server";
import { signOutAction } from "./actions/auth";

export async function SiteNav() {
  const session = await loadSession(await createClient());
  return (
    <nav className="flex items-center gap-4 text-sm">
      {session ? (
        <>
          <Link href="/">ダッシュボード</Link>
          <Link href="/identity">本人確認</Link>
          <Link href="/host-applications">掲載申込</Link>
          <form action={signOutAction}>
            <button type="submit" className="text-zinc-600 underline">
              ログアウト
            </button>
          </form>
        </>
      ) : (
        <Link href="/login">ログイン</Link>
      )}
    </nav>
  );
}
