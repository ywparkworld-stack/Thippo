# thippo

遊休スペース（空き会議室・空き部屋）を 30 分単位で貸し出す予約型マーケットプレイス。
仕様は [SPEC.md](SPEC.md) を参照。実装中に決まったことは SPEC.md の付録に記録する。

## 構成

```
apps/
  guest/   利用者サイト        http://localhost:3000
  host/    貸出主センター      http://localhost:3001
  admin/   運営管理            http://localhost:3002
packages/
  core/          料金計算・返金判定・下限料金・枠の計算（純粋関数）と設定値
  db/            Supabase の型定義とクライアント生成
  auth/          3アプリ共通の認証（proxy・ログイン・2段階認証・レート制限・操作ログ）
  mail/          メールの文面（templates.ts に集約）と送信（Resend）
  payments/      Stripe（Connect・決済・返金・Webhook の署名検証と重複処理の防止）
  invoice/       月次明細・請求書（適格請求書）の PDF
  observability/ Sentry の共通設定（個人情報を送らない）
e2e/             E2E テスト（Playwright）
  ui/            共通の UI コンポーネント
  eslint-config/ ESLint の共通設定
  next-config/   Next.js の共通設定
supabase/
  migrations/    スキーマ・RLS・排他制約・DB 関数
  tests/         DB のテスト（RLS・制約・core との一致）
legacy/          以前の試作アプリ（ビルド・CI の対象外）
```

## 開発

Node.js 22 と pnpm 10 を使う。

```sh
pnpm install
pnpm dev:guest            # 利用者サイト
pnpm lint                 # ESLint
pnpm typecheck            # 型チェック
pnpm test                 # 単体テスト + DB テスト
pnpm format               # Prettier
```

### DB テスト

`supabase/tests` は、マイグレーションを適用したデータベースに対して RLS・制約・DB 関数を確かめる。
2 通りの実行方法がある。

1. **素の PostgreSQL（Docker 不要）**：`TEST_PG_URL`（既定 `postgres://postgres@localhost:54329/postgres`）の
   サーバーに `thippo_test` データベースを作り直し、Supabase の最小限の再現（`supabase/tests/shim`）と
   マイグレーションを適用してから実行する。PostgreSQL 16 以上と `btree_gist` が必要。
2. **ローカルの Supabase**：`supabase start` のあと、`SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:db`。

CI では両方を実行する（`.github/workflows/ci.yml`）。

## 権限の方針（SPEC §3）

- ブラウザから届くリクエスト（anon / authenticated）には、テーブル・列ごとに必要な権限だけを付け、行は RLS で絞る。
- 注文・予約・返金・審査などの状態を変える操作は、ブラウザから直接書き込ませない。
  サーバー（service_role）または security definer の DB 関数を通し、その中で権限を確かめて `audit_logs` に記録する。
- 運営（admin）は JWT の `aal` が `aal2`（2 段階認証済み）のときだけ admin として扱う。
- admin ロールは DB を直接操作する運用者（postgres）だけが付与できる。service_role からも付与できない。
- 料金・手数料の計算は `packages/core` と DB 関数（`private.calc_booking_fees` など）の 2 か所にあり、
  テストで一致を確かめている。設定値を変えるときは `packages/core/src/config.ts` と
  `supabase/migrations/*_pricing.sql` の `private.pricing_config()` を両方変える。

## 認証と運営管理

- 認証の設定とロールの考え方：[docs/auth.md](docs/auth.md)
- 運営管理のアクセス制限・admin ロールの付与：[docs/admin-access.md](docs/admin-access.md)
- Stripe の設定と Webhook：[docs/stripe.md](docs/stripe.md)
- 定期実行とメール：[docs/operations.md](docs/operations.md)
- デプロイ手順：[docs/deploy.md](docs/deploy.md)
- 本番リリースのチェックリスト：[docs/release-checklist.md](docs/release-checklist.md)
- E2E テスト：`e2e/`（GitHub Actions の `.github/workflows/e2e.yml` で実行。準備は [docs/e2e-setup.md](docs/e2e-setup.md)）

ローカルで運営管理を開くときは、admin アプリの `.env.local` に `APP_ENV=development` と `ADMIN_ACCESS_GATE=none` を設定する。

## 環境変数

キー名は [.env.example](.env.example) を参照。値はリポジトリに含めない。
