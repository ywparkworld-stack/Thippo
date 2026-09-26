/** Supabase の接続先。URL と anon key は公開してよい値（RLS で守る）。 */
export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`環境変数 ${name} が設定されていません`);
  return value;
}

/** 公開バケット（スペースの写真）のファイルの URL */
export function publicStorageUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
