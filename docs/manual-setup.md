# 手作業での運用：準備と毎日の作業

SPEC 付録 D39。当分は、外部サービスは **Vercel（サイトの公開）と Supabase（データ・ログイン）だけ** を使い、
それ以外（メール送信サービス・Stripe・Sentry・定期実行の仕組み）は使わない。
自動で行っていた作業は、運営が運営管理の画面で手作業で行う。

| 本来の仕組み                         | 当分の運用                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 定期実行（期限切れ・リマインドなど） | 運営管理の **「定期処理」** の画面でボタンを押す                                                |
| アプリからのメール送信（Resend）     | 運営管理の **「送信待ちのメール」** に溜まる。運営が自分のメールソフトから送る                  |
| 決済（Stripe）                       | テスト用の支払いモード（お金は動かない。付録 D37）。Stripe のキーを入れなければ自動でこれになる |
| エラー監視（Sentry）                 | 使わない。エラーは Vercel のログ（Logs）で確認する                                              |
| 運営管理の前段の制限（Cloudflare）   | 使わない。ログインと2段階認証だけで守る                                                         |

会員登録の確認・パスワード再設定・貸出主の招待のメールは、Supabase から自動で送られる（Supabase の機能）。
Supabase の標準のメール送信は **1時間に数通まで** の制限がある。

---

## 1. Supabase

### 1-1. プロジェクトを作る

1. https://supabase.com で **New project**。
   - Region：**Northeast Asia (Tokyo)**
   - Database Password：安全な場所に保存する
2. 数分待つ。

### 1-2. データベースを用意する（1回だけ）

1. リポジトリの [`supabase/setup-all.sql`](../supabase/setup-all.sql) を開き、全部コピーする。
2. Supabase の **SQL Editor** に貼り付けて **Run**。「Success. No rows returned」と出れば成功。
3. **2回目は実行しない**（エラーになる）。

> データベースの設計を変えたとき（`supabase/migrations` に新しいファイルが増えたとき）は、
> 増えたファイルの中身だけを SQL Editor で実行する。`setup-all.sql` は最初の1回だけに使う。

### 1-3. ログインの設定

**Authentication → URL Configuration**

- Site URL：利用者サイトの URL（例 `https://guest-xxxx.vercel.app`）
- Redirect URLs：3つのサイトの URL の後ろに `/**` を付けて登録する
  - `https://guest-xxxx.vercel.app/**`
  - `https://host-xxxx.vercel.app/**`
  - `https://admin-xxxx.vercel.app/**`

**Authentication → Emails → Templates**（確認メールのリンクを各サイトの `/auth/confirm` に向けるため）

- Confirm signup・Reset password・Invite user・Change email address の4つを、
  リポジトリの `supabase/templates/` の同じ名前のファイルの中身に置き換える。
- 件名は [auth.md](auth.md) のとおり。

### 1-4. 3つの値を控える

**Project Settings → API Keys / Data API**

- Project URL（`https://xxxx.supabase.co`）
- anon key（新しい画面では publishable key）
- service_role key（新しい画面では secret key）… **外に出さない**

---

## 2. Vercel

3つのプロジェクト（Root Directory：`apps/guest`・`apps/host`・`apps/admin`）の
**Settings → Environment Variables** に入れる。入れたら、それぞれ **Deployments → … → Redeploy**。

| Key                                                                                 | 値                                                               | guest | host | admin |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | :---: | :--: | :---: |
| `NEXT_PUBLIC_SUPABASE_URL`                                                          | Project URL                                                      |   ○   |  ○   |   ○   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                     | anon（publishable）key                                           |   ○   |  ○   |   ○   |
| `SUPABASE_SERVICE_ROLE_KEY`                                                         | service_role（secret）key                                        |   ○   |  ○   |   ○   |
| `APP_ENV`・`NEXT_PUBLIC_APP_ENV`                                                    | `staging`                                                        |   ○   |  ○   |   ○   |
| `NEXT_PUBLIC_GUEST_URL`                                                             | 利用者サイトの URL                                               |   ○   |  ○   |   ○   |
| `NEXT_PUBLIC_HOST_URL`                                                              | 貸出主センターの URL                                             |   ○   |  ○   |   ○   |
| `ADMIN_URL`                                                                         | 運営管理の URL                                                   |       |      |   ○   |
| `ADMIN_ACCESS_GATE`                                                                 | `vercel`                                                         |       |      |   ○   |
| `OPERATOR_COMPANY_NAME`・`OPERATOR_ADDRESS`・`OPERATOR_INVOICE_REGISTRATION_NUMBER` | 運営会社の名前・住所・インボイス登録番号（領収書・請求書に出る） |   ○   |      |   ○   |
| `CONTACT_EMAIL`                                                                     | お問い合わせを受けるメールアドレス                               |   ○   |      |       |
| `ADMIN_NOTIFICATION_EMAIL`                                                          | 掲載申込の通知を受けるメールアドレス                             |   ○   |      |       |

- `APP_ENV` は当分 `staging` のままにする。テスト用の支払いモードは `production` では動かない（付録 D37）。
- Stripe・Resend・Sentry・Cloudflare のキーは入れない。
- `ADMIN_ACCESS_GATE=vercel` は「アプリ側では前段の制限を確かめない」という意味。運営管理はログインと2段階認証だけで守られる。
  運営管理の URL は人に教えない。

---

## 3. 運営アカウント

[admin-access.md](admin-access.md) の「2. admin ロールの付与」のとおり。

1. Supabase の **Authentication → Users → Add user → Create new user**（**Auto Confirm User** にチェック）
2. **SQL Editor** で admin ロールを付ける SQL を実行する
3. 運営管理の `/login` からログインし、認証アプリ（Google Authenticator など）で2段階認証を設定する

---

## 4. 毎日の作業（運営管理）

| いつ                   | 画面                | 作業                                                                                   |
| ---------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| 1日に数回              | ダッシュボード      | 「本人確認の審査待ち」「掲載申込の審査待ち」「送信待ちのメール」の件数を見る           |
| 1日に数回              | 送信待ちのメール    | 古い順に、宛先・件名・本文をコピーして運営のメールアドレスから送り、「送信済みにする」 |
| 利用がある日はこまめに | 定期処理            | 「2時間前のリマインドを作る」→ 送信待ちのメールを送る                                  |
| 毎日夕方               | 定期処理            | 「前日のリマインドを作る」→ 送信待ちのメールを送る                                     |
| 1日1回                 | 定期処理            | 「利用が終わった予約を『利用済み』にする」「片付け」                                   |
| 随時                   | 定期処理            | 「支払い期限切れの注文を閉じる」（購入手続きのときにも自動で行うので、通常は不要）     |
| 毎月1日以降            | 定期処理 / 月次集計 | 前月分の月次明細・請求書を発行する → 送信待ちのメールを送る                            |

- どの処理も、2回押しても結果は変わらない。押したことは操作ログに残る。
- お問い合わせと掲載申込の通知も「送信待ちのメール」に入る（宛先が `CONTACT_EMAIL`・`ADMIN_NOTIFICATION_EMAIL`）。
  内容はその画面で読めるので、送らずに「送らずに一覧から外す」でもよい。

---

## 5. 本来の仕組みに戻すとき

- メール：Vercel に `RESEND_API_KEY`・`MAIL_FROM` を入れると、自動で送るようになる（[operations.md](operations.md)）
- 決済：[stripe.md](stripe.md)
- 定期実行：Vercel の Pro プランの Cron、または GitHub Actions など（付録 D30・D38 の記録を参照）
- 運営管理の前段の制限：[admin-access.md](admin-access.md) の Cloudflare Access
