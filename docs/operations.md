# 定期実行とメール

## 定期実行（SPEC §11・付録 D30）

GitHub Actions のスケジュール（`.github/workflows/cron.yml`）で、利用者サイト（`apps/guest`）の Route Handler を呼ぶ（付録 D38）。
Vercel の Hobby プランでは1日1回より多い Cron を登録できないため、Vercel Cron は使わない。

- GitHub の Secrets に `CRON_BASE_URL`（利用者サイトの本番の URL）と `CRON_SECRET`（Vercel の環境変数と同じ値）を登録する。
  どちらかがなければ、何もせずに終わる。
- 呼び出しには `Authorization: Bearer <CRON_SECRET>` が必要。
- スケジュールは既定のブランチ（`claude/awesome-hypatia-hPsoe`）でだけ動く。混んでいると数分遅れることがある。
- リポジトリに60日間動きがないと、GitHub がスケジュールを止める。止まったら Actions の画面で有効にし直す。
- 失敗すると GitHub Actions の実行が赤くなる（GitHub から通知が届く）。Actions の画面の「Run workflow」で、処理を選んで手動でも実行できる。
- 1回の実行は60秒まで（Hobby プランの上限）。途中で終わっても、次の実行で続きを処理する。

| パス                             | スケジュール（UTC） | 東京時間               | 内容                                                                                          |
| -------------------------------- | ------------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| `/api/cron/expire-orders`        | `*/5 * * * *`       | 5分ごと                | 15分以上 pending の注文を expired にして枠を解放し、PaymentIntent を取り消す                  |
| `/api/cron/complete-bookings`    | `*/15 * * * *`      | 15分ごと               | 利用終了時刻を過ぎた予約を completed にする                                                   |
| `/api/cron/reminders-two-hours`  | `*/15 * * * *`      | 15分ごと               | 利用開始2時間前のリマインド（D31）                                                            |
| `/api/cron/reminders-day-before` | `0 9 * * *`         | 毎日 18:00             | 翌日の予約のリマインド（D31）                                                                 |
| `/api/cron/stripe-fees`          | `7 * * * *`         | 毎時                   | 実際の Stripe 手数料（balance_transaction の stripe_fee）を保存する                           |
| `/api/cron/monthly-statements`   | `10 * 1 * *`        | 毎月1日 9:10〜（毎時） | 前月分の月次明細・請求書 PDF を発行し、貸出主に通知する                                       |
| `/api/cron/cleanup`              | `30 18 * * *`       | 毎日 3:30              | レート制限のカウンター・提出されなかった本人確認のファイル・保存期間を過ぎた書類の削除（D33） |

- どの処理も、同じものを2回実行しても結果が変わらないように作っている（リマインドは送信済みの印を付けてから送る、明細は1か月に1回だけ発行など）。
- 失敗すると 500 を返し、Vercel のログと GitHub Actions の実行結果に残る。
- 本人確認書類の保存期間は `packages/core/src/config.ts` の `IDENTITY.documentRetentionDaysAfterWithdrawal`。
  TODO(要確認): 期間が決まるまでは `null` で、書類は削除しない。

手動で実行するとき：

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://<利用者サイト>/api/cron/complete-bookings
```

## メール（SPEC §12）

- 文面は `packages/mail/src/templates.ts` にまとめている（会員登録の確認・パスワード再設定・貸出主の招待は Supabase Auth が送るため `supabase/templates/`）。
- 送信は Resend。送ったメールは `notifications` に記録し、同じキーのメールは二重に送らない。
- 送信に失敗しても元の処理（予約の確定・キャンセルなど）は取り消さない。`notifications.status = failed` を確認する。

| メール                   | いつ                               | 宛先                                    |
| ------------------------ | ---------------------------------- | --------------------------------------- |
| 本人確認の承認・却下     | 運営が審査したとき                 | 利用者                                  |
| 掲載申込の受付           | 申込のとき                         | 申込者（運営にも通知）                  |
| 予約確定                 | 支払いが確定したとき               | 利用者・貸出主の担当者                  |
| キャンセル               | キャンセルしたとき                 | 利用者・貸出主の担当者                  |
| 返金完了                 | Stripe の返金が完了したとき        | 利用者                                  |
| 期限切れ後の支払いの返金 | 期限切れの注文に支払いがあったとき | 利用者                                  |
| リマインド               | 前日18:00・利用開始2時間前         | 利用者                                  |
| 月次明細の発行           | 明細を発行したとき                 | 貸出主の担当者                          |
| お問い合わせ             | お問い合わせのとき                 | お問い合わせ先（CONTACT_EMAIL）・送信者 |
