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
          <Link href="/bookings">予約</Link>
          <Link href="/spaces">スペース</Link>
          <Link href="/sales">売上・振込</Link>
          <Link href="/account">アカウント</Link>
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
