# 認証の設定（Supabase Auth）

3 つのアプリは 1 つの Supabase プロジェクトを共有する。セッションの cookie はアプリのドメインごとに別になる
（ドメイン属性を付けないため、`thippo.example` の cookie は `host.thippo.example` に送られない）。

## ロールとアカウント

| ロール | 作り方                                              | 入れるアプリ               |
| ------ | --------------------------------------------------- | -------------------------- |
| guest  | 利用者サイトの会員登録                              | 利用者サイト               |
| host   | 運営が掲載申込を承認したときの招待（フェーズ 4）    | 貸出主センター             |
| admin  | DB で直接付与（[admin-access.md](admin-access.md)） | 運営管理（2 段階認証必須） |

- 会員登録で作られるアカウントは常に guest。登録時のメタデータのロールは使わない。
- 1 つのアカウントのロールは 1 つ。利用者と貸出主を兼ねる場合は別のメールアドレスで別のアカウントを使う（SPEC 付録 D6）。
- 各アプリの proxy（旧 middleware）とサーバー側の `requireAppSession` の両方で、ロール・停止状態・（運営管理は）`aal2` を確かめる。
  ロールが合わないセッションは破棄してログイン画面に戻す。

## Supabase のダッシュボードで設定すること（staging・production）

ローカルは `supabase/config.toml` に同じ設定がある。

1. **Authentication → URL Configuration**
   - Site URL：利用者サイトの URL
   - Redirect URLs：3 アプリの URL（`https://thippo.example/**`、`https://host.thippo.example/**`、`https://admin.thippo.example/**`）
2. **Authentication → Providers → Email**
   - Confirm email：オン
   - Secure email change：オン
   - Minimum password length：10、Password requirements：Letters and digits
3. **Authentication → Multi-Factor**：TOTP をオン
4. **Authentication → Emails → Templates**：`supabase/templates/*.html` の文面と件名（`config.toml`）を設定する
   - リンクは `{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` の形にする（各アプリの `/auth/confirm` で確かめる）
5. **Authentication → Emails → SMTP Settings**：Resend の SMTP（`smtp.resend.com`、ユーザー `resend`、パスワードは API キー）を設定する
6. **Authentication → Rate Limits**：`config.toml` の `[auth.rate_limit]` と同じ値にする

## レート制限（SPEC §3.3、付録 D5）

- アプリ側：ログイン・会員登録・パスワード再設定・2 段階認証の確認は、Postgres の `public.consume_rate_limit` で
  IP アドレス単位とメールアドレス（利用者）単位の両方を数える。上限は `packages/core/src/config.ts` の `RATE_LIMITS`。
- Supabase Auth 側：Auth の API を直接呼ばれた場合に備え、Supabase のレート制限も設定する。
- IP アドレスは `x-forwarded-for` の先頭を使う（Vercel が上書きするため偽装できない）。キーはハッシュにして保存する。

## Google ログインを追加するとき

`signInWithOAuth({ provider: "google", options: { redirectTo: <アプリの URL>/auth/callback } })` を呼ぶボタンと、
`exchangeCodeForSession` を行う `/auth/callback` の Route Handler を利用者サイトに追加する。
ロールは会員登録と同じく guest になり、proxy とサーバー側の確認はそのまま使える。
