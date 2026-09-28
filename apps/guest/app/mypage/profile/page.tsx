import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { Card } from "@thippo/ui";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const { supabase, userId } = await requireAppSession("guest", "/mypage/profile");
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, phone, email")
    .eq("id", userId)
    .single();
  return (
    <Card className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">会員情報の編集</h1>
      <p className="text-sm text-zinc-600">メールアドレス：{profile?.email}</p>
      <ProfileForm displayName={profile?.display_name ?? ""} phone={profile?.phone ?? ""} />
      <Link href="/mypage" className="text-sm text-brand-700 underline">
        マイページに戻る
      </Link>
    </Card>
  );
}
