# 運営管理のアクセス制限

SPEC §3.2 の運用手順。運営管理（`apps/admin`）は次の 3 段で守る。

1. **前段のアクセス制限**：許可したメールアドレスまたは IP アドレス以外からは、画面自体を表示させない（Cloudflare Access）
2. **ログインと 2 段階認証**：`admin` ロールのアカウントでパスワードでログインし、TOTP の確認が済む（JWT の `aal` が `aal2` になる）まで、2 段階認証の画面以外は開けない
3. **DB の権限**：RLS は `aal2` の admin だけを admin として扱う。運営用のデータの書き込みはサーバーと DB 関数だけが行い、`audit_logs` に記録する

運営管理のURLは、利用者サイトと貸出主センターのどこからもリンクしない。検索エンジンにも載せない（`X-Robots-Tag: noindex`、`robots.txt` で全体を拒否）。

---

## 1. 前段のアクセス制限

### 推奨：Cloudflare Access

アプリ側でも Cloudflare Access の JWT を検証するので、Cloudflare を通らずに Vercel の URL（`*.vercel.app`）へ直接来たリクエストも拒否できる。

1. `admin.<本番ドメイン>` の DNS を Cloudflare で管理し、Vercel の admin プロジェクトへの CNAME を **Proxied（オレンジ色の雲）** にする。
2. Cloudflare Zero Trust → Access → Applications → **Add an application** → **Self-hosted**。
   - Application domain：`admin.<本番ドメイン>`（staging も同様に `admin.staging.<ドメイン>` で別のアプリケーションを作る）
   - Session duration：8 時間以下
3. ポリシーを作る。
   - Action：Allow
   - Include：**Emails** に運営担当者のメールアドレスを列挙する（またはメールドメイン）
   - 必要なら Require：**IP ranges** にオフィスの IP アドレス
   - ログイン方法は One-time PIN または社内の IdP
4. アプリケーションの **Overview** にある **Application Audience (AUD) Tag** をコピーする。
5. Vercel の admin プロジェクトの環境変数を設定する（Production と Preview の両方）。

   | キー                    | 値                                |
   | ----------------------- | --------------------------------- |
   | `ADMIN_ACCESS_GATE`     | `cloudflare`                      |
   | `CF_ACCESS_TEAM_DOMAIN` | `<チーム名>.cloudflareaccess.com` |
   | `CF_ACCESS_AUD`         | 手順 4 の AUD タグ                |
   | `APP_ENV`               | `production` または `staging`     |

6. 確認する。
   - 許可していないメールアドレスでは Cloudflare のログイン画面から先に進めないこと
   - `https://<admin プロジェクト>.vercel.app/login` を直接開くと **403 Forbidden** になること
7. Vercel の admin プロジェクトで **Deployment Protection → Vercel Authentication** を有効にし、Preview デプロイも保護する。

### 代わりの方法：Vercel の Password Protection / Trusted IPs

Cloudflare を使わない場合は、Vercel の admin プロジェクトで **Deployment Protection** の **Password Protection**（Pro の追加機能）または **Trusted IPs**（Enterprise）を **Production を含めて** 有効にし、`ADMIN_ACCESS_GATE=vercel` にする。
この場合、アプリ側では前段の制限を確かめないため、Vercel の設定が外れていないか定期的に確認すること。

### 設定漏れの防止

- `ADMIN_ACCESS_GATE` の既定は `cloudflare`。`CF_ACCESS_TEAM_DOMAIN`・`CF_ACCESS_AUD` がないと、運営管理のすべての画面が 403 になる（設定漏れで無防備にならない）。
- `ADMIN_ACCESS_GATE=none` は `APP_ENV=development`（ローカル）でだけ有効。staging・production では 403 になる。

---

## 2. admin ロールの付与

admin ロールは **どの画面からも付与できない**。DB を直接操作する運用者（`postgres` ロール）だけが付与できる。
サーバーの service role からの付与も DB のトリガー（`private.guard_profile`）で拒否される。

運営担当者のメールアドレスは、利用者・貸出主として使っていないものにする（1 つのアカウントのロールは 1 つだけ。SPEC 付録 D6）。

1. Supabase のダッシュボード → **Authentication → Users → Add user → Create new user**
   - メールアドレスと仮のパスワードを入力し、**Auto Confirm User** にチェックする
2. Supabase のダッシュボード → **SQL Editor**（`postgres` ロールで実行される）で次を実行する。

   ```sql
   begin;

   update public.profiles
      set role = 'admin'
    where email = 'ops@example.com'   -- 付与する運営担当者
    returning id;

   insert into public.audit_logs (actor_id, action, target_table, target_id, payload)
   select null, 'admin.role_granted', 'profiles', id::text,
          jsonb_build_object('granted_by', '作業者の名前', 'ticket', '申請番号など')
     from public.profiles
    where email = 'ops@example.com';

   commit;
   ```

3. 担当者に仮のパスワードを別の経路で伝える。担当者は運営管理にログインし、**2 段階認証を設定**してから、**パスワードを変更**する（`/password/reset`）。
4. 担当者が Cloudflare Access のポリシーに含まれているか確認する。

### admin ロールの剥奪

退職・異動のときは、同じ手順で `role = 'guest'` に戻し、`status = 'suspended'` にする。

```sql
begin;
update public.profiles set role = 'guest', status = 'suspended' where email = 'ops@example.com';
insert into public.audit_logs (actor_id, action, target_table, target_id, payload)
select null, 'admin.role_revoked', 'profiles', id::text, jsonb_build_object('revoked_by', '作業者の名前')
  from public.profiles where email = 'ops@example.com';
commit;
```

あわせて Cloudflare Access のポリシーからメールアドレスを外し、Supabase のダッシュボードで
ユーザーのセッションを無効にする（**Authentication → Users → ユーザー → Sign out user**、または削除）。

### 2 段階認証の再設定（端末の紛失など）

本人確認のうえ、SQL Editor で TOTP の登録を削除する。次のログイン時に設定し直しになる。

```sql
delete from auth.mfa_factors where user_id = (select id from public.profiles where email = 'ops@example.com');
insert into public.audit_logs (actor_id, action, target_table, target_id, payload)
select null, 'admin.mfa_reset', 'profiles', id::text, jsonb_build_object('reset_by', '作業者の名前')
  from public.profiles where email = 'ops@example.com';
```

---

## 3. 操作ログ（audit_logs）

- 追記のみ。service role を含め、更新・削除・TRUNCATE はトリガーで拒否される。
- 運営管理が記録するもの（フェーズ 2 時点）：ログイン（`admin.login`）、ログイン失敗（`admin.login_failed`）、
  admin 以外のアカウントでのログインの試み（`admin.login_denied`）、2 段階認証の設定・確認・失敗
  （`admin.mfa_enrolled` / `admin.mfa_verified` / `admin.mfa_failed`）、パスワード変更、ログアウト。
- 運営の操作（本人確認の承認・却下、アカウント停止、スペースの公開停止、手動返金など）は、
  各フェーズで DB 関数の中から `private.write_audit_log` を呼び、操作と同じトランザクションで記録する。
