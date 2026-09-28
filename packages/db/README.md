# @thippo/db

Supabase の型定義とクライアント生成。

| import               | 用途                                                           |
| -------------------- | -------------------------------------------------------------- |
| `@thippo/db`         | 型（`Database`, `Tables<"bookings">` など）                    |
| `@thippo/db/browser` | ブラウザ用クライアント（RLS が効く）                           |
| `@thippo/db/server`  | サーバー用クライアント（ログイン中の利用者の権限。RLS が効く） |
| `@thippo/db/admin`   | service role クライアント（RLS を無視する。サーバー専用）      |

## 型定義の更新

マイグレーションを変更したら `src/database.types.ts` を作り直す。

```sh
supabase start           # Docker が必要
pnpm --filter @thippo/db db:types
```

Docker が使えない環境では、マイグレーションを適用した PostgreSQL から予備のスクリプトで生成できる。

```sh
DATABASE_URL=postgres://postgres@localhost:54329/thippo_test pnpm --filter @thippo/db gen:types:pg
```
