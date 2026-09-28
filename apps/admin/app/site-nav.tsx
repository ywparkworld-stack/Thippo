import Link from "next/link";
import { createClient, loadSession } from "@thippo/auth/server";
import { signOutAction } from "./actions/auth";

export async function SiteNav() {
  const session = await loadSession(await createClient());
  return (
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {session ? (
        <>
          <Link href="/">ダッシュボード</Link>
          <Link href="/identity">本人確認</Link>
          <Link href="/host-applications">掲載申込</Link>
          <Link href="/hosts">貸出主</Link>
          <Link href="/users">利用者</Link>
          <Link href="/orders">予約・決済</Link>
          <Link href="/refunds">返金</Link>
          <Link href="/statements">月次集計</Link>
          <Link href="/cancel-monitor">キャンセル監視</Link>
          <Link href="/audit-logs">操作ログ</Link>
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
