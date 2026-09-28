import Link from "next/link";
import { createClient, loadSession } from "@thippo/auth/server";
import { signOutAction } from "./actions/auth";
import { CartSync } from "./_components/cart-sync";

export async function SiteNav() {
  const session = await loadSession(await createClient());
  return (
    <nav className="flex items-center gap-4 text-sm">
      <CartSync signedIn={session?.role === "guest"} />
      <Link href="/cart">予約カゴ</Link>
      {session ? (
        <>
          <Link href="/mypage">マイページ</Link>
          <form action={signOutAction}>
            <button type="submit" className="text-zinc-600 underline">
              ログアウト
            </button>
          </form>
        </>
      ) : (
        <>
          <Link href="/hosts">スペースを掲載する</Link>
          <Link href="/login">ログイン</Link>
          <Link href="/signup" className="rounded-md bg-brand-600 px-3 py-1.5 text-white">
            会員登録
          </Link>
        </>
      )}
    </nav>
  );
}
