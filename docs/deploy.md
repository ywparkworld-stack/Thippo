# デプロイ手順（staging・production）

> **当分は手作業での運用（付録 D39）。** Vercel と Supabase だけを使う手順は [manual-setup.md](manual-setup.md) を見る。
> このページは、Stripe・メール送信・自動の定期実行などを使う本来の構成の手順。

SPEC §2・§13-11。付録 D34（手順書と設定ファイルは実装側が用意し、作業は運営が行う）。
staging と production は同じ手順で、別々の Supabase プロジェクト・Vercel プロジェクト・Stripe のモードを使う。

| 環境       | Supabase          | Stripe       | Vercel                                                                  | ドメイン（例）                                                                          |
| ---------- | ----------------- | ------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| staging    | thippo-staging    | テストモード | 3プロジェクト（Preview/Production のうち Production を staging に使う） | `staging.thippo.example`、`host.staging.thippo.example`、`admin.staging.thippo.example` |
| production | thippo-production | 本番モード   | 3プロジェクト                                                           | `thippo.example`、`host.thippo.example`、`admin.thippo.example`                         |

TODO(要確認): 本番のドメイン（SPEC §16）。

---

## 1. Supabase

1. Supabase で新しいプロジェクトを作る（リージョンは東京 `ap-northeast-1`）。データベースのパスワードは安全な場所に保存する。
2. ローカルからマイグレーションを適用する。

   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push          # supabase/migrations を適用（ストレージのバケットも作られる）
   ```

3. 認証の設定は [auth.md](auth.md) の「Supabase のダッシュボードで設定すること」のとおりにする（URL・メールの確認・TOTP・メールの文面・SMTP・レート制限）。
4. **Project Settings → API** の URL・anon key・service_role key を控える（service_role key はサーバーの環境変数だけに入れる）。
5. **Database → Backups**：Point in Time Recovery を有効にする（production）。
6. 運営のアカウントを [admin-access.md](admin-access.md) の手順で作る。

## 2. Stripe

1. [stripe.md](stripe.md) の Connect の設定を行う（production は本番モード、staging はテストモード）。
2. Webhook のエンドポイントを2つ登録し、それぞれの署名シークレットを控える。
   - `https://<利用者サイト>/api/webhooks/stripe`（アカウントのイベント）：`payment_intent.succeeded`、`payment_intent.canceled`、`charge.refunded`、`charge.refund.updated`
   - `https://<利用者サイト>/api/webhooks/stripe-connect`（連結アカウントのイベント）：`account.updated`
3. API キー（公開可能キー・シークレットキー）を控える。シークレットキーは制限付きキーにしてもよい（必要な権限：PaymentIntents・Refunds・Transfers・Accounts・Account Links・Login Links・Charges・Balance Transactions の書き込みまたは読み取り）。

## 3. Resend

1. 送信元のドメイン（例 `mail.thippo.example`）を追加し、DNS に SPF・DKIM・DMARC のレコードを登録する。
2. API キーを作る。Supabase Auth の SMTP にも同じドメインを使う（[auth.md](auth.md)）。

## 4. Sentry

1. 組織の中に3つのプロジェクト（Next.js）を作る：`thippo-guest`、`thippo-host`、`thippo-admin`。
2. 各プロジェクトの DSN と、ソースマップのアップロード用の Auth Token（Organization Token）を控える。
3. アラートのルール：新しいエラー・エラーの急増を運営のチャンネル（メールや Slack）に通知する。

## 5. Vercel（3プロジェクト）

同じ GitHub リポジトリから3つのプロジェクトを作る。

| プロジェクト | Root Directory | Framework | 備考                                                                                             |
| ------------ | -------------- | --------- | ------------------------------------------------------------------------------------------------ |
| thippo-guest | `apps/guest`   | Next.js   | 定期実行は GitHub Actions からこのプロジェクトを呼ぶ（付録 D38。[operations.md](operations.md)） |
| thippo-host  | `apps/host`    | Next.js   |                                                                                                  |
| thippo-admin | `apps/admin`   | Next.js   | [admin-access.md](admin-access.md) の前段のアクセス制限を設定する                                |

- Install Command：`pnpm install --frozen-lockfile`（Root Directory の外の workspace も含めるため、「Include files outside of the Root Directory」をオンにする）
- Node.js：22.x
- Function Region：`hnd1`（東京）
- プロジェクトを作るときに選んだフォルダの名前が、そのままプロジェクト名になる。`packages/*`（共有のコード）はアプリではないため、選ぶとビルドが失敗する。必ず `apps/guest`・`apps/host`・`apps/admin` のどれかを選ぶ。
- Root Directory などの設定を変えても、すでにあるデプロイはやり直されない。変えたあとは Deployments の最新のデプロイで「Redeploy」を押すか、次の push を待つ。

### 環境変数

キー名は [.env.example](../.env.example)。アプリごとに必要なものだけを入れる。

| キー                                                                                              | guest | host | admin |
| ------------------------------------------------------------------------------------------------- | ----- | ---- | ----- |
| `APP_ENV`・`NEXT_PUBLIC_APP_ENV`（`staging` / `production`）                                      | ○     | ○    | ○     |
| `NEXT_PUBLIC_GUEST_URL`・`NEXT_PUBLIC_HOST_URL`                                                   | ○     | ○    | ○     |
| `ADMIN_URL`                                                                                       |       |      | ○     |
| `NEXT_PUBLIC_SUPABASE_URL`・`NEXT_PUBLIC_SUPABASE_ANON_KEY`                                       | ○     | ○    | ○     |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                       | ○     | ○    | ○     |
| `PAYMENTS_MODE`（`stripe` / `stub`。本番は `stripe` か未設定）                                    | ○     | ○    |       |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                                                              | ○     |      |       |
| `STRIPE_SECRET_KEY`                                                                               | ○     | ○    | ○     |
| `STRIPE_WEBHOOK_SECRET`・`STRIPE_CONNECT_WEBHOOK_SECRET`                                          | ○     |      |       |
| `RESEND_API_KEY`・`MAIL_FROM`                                                                     | ○     | ○    | ○     |
| `CONTACT_EMAIL`・`ADMIN_NOTIFICATION_EMAIL`                                                       | ○     |      |       |
| `OPERATOR_COMPANY_NAME`・`OPERATOR_ADDRESS`・`OPERATOR_INVOICE_REGISTRATION_NUMBER`               | ○     | ○    | ○     |
| `ADMIN_ACCESS_GATE`・`CF_ACCESS_TEAM_DOMAIN`・`CF_ACCESS_AUD`                                     |       |      | ○     |
| `NEXT_PUBLIC_SENTRY_DSN`（アプリごとの DSN）・`SENTRY_AUTH_TOKEN`・`SENTRY_ORG`・`SENTRY_PROJECT` | ○     | ○    | ○     |

- staging と production で値を分ける（Stripe はテストキーと本番キー、Supabase は別プロジェクト）。
- Stripe の準備ができるまでは、staging を `PAYMENTS_MODE=stub`（テスト用の支払いモード。[stripe.md](stripe.md#テスト用の支払いモードpayments_modestub)）で動かせる。このとき Stripe のキーと Webhook は不要。production では使えない。
- `SUPABASE_SERVICE_ROLE_KEY`・`STRIPE_SECRET_KEY` などは Sensitive にする。

### ドメイン

- 各プロジェクトにドメインを割り当てる。運営管理のドメインは Cloudflare を経由させる（[admin-access.md](admin-access.md)）。
- Supabase Auth の Site URL・Redirect URLs、Stripe の Webhook の URL を実際のドメインに合わせる。

## 6. デプロイ後の確認（staging）

1. `https://<利用者サイト>/` が表示される。
2. 運営管理：Cloudflare Access を通らない URL（`*.vercel.app`）は 403、通ると `/login` が表示される。
3. [release-checklist.md](release-checklist.md) の「staging での通しの確認」を行う。
4. 運営管理の「定期処理」の画面で各処理を1回ずつ実行し、成功することを確認する（定期実行の仕組みを用意するまでは手作業。付録 D39）。
