# Stripe の設定

決済は Stripe Connect（Express アカウント、Destination charges）。development と staging はテストモードのキーを使う。

## テスト用の支払いモード（PAYMENTS_MODE=stub）

Stripe の準備ができるまで、Stripe につながずにサービス全体を動かすためのモード（SPEC 付録 D37）。
環境変数 `PAYMENTS_MODE=stub` で有効になり、Stripe のキー・Webhook は不要になる。
`PAYMENTS_MODE` を入れない場合も、`STRIPE_SECRET_KEY` がなければ stub になる（付録 D39）。

| 操作                   | stub での動き                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 支払い                 | カード情報を入力せず、「支払う」で注文を支払い済みにする。金額・枠の確保・期限切れの扱いは Stripe のときと同じ（DB 関数） |
| キャンセル・返金       | 返金額・差し戻し額の判定は同じ。Stripe の処理の代わりに記録だけ行い、すぐ「完了」にする                                   |
| 入金先の登録（貸出主） | 「入金先を登録する（テスト）」で登録済みにする。Stripe の管理画面へのリンクは出さない                                     |
| 決済手数料の実額       | 取得しない（運営管理では「未取得」のまま）                                                                                |

- DB に残る Stripe の id は `pi_stub_`・`ch_stub_`・`tr_stub_`・`re_stub_`・`trr_stub_`・`acct_stub_` で始まる。
  運営管理の注文の画面には「テスト用の支払い」と表示する。
- **`APP_ENV=production` では使えない**（決済の処理が例外になる）。実際のお金は動かないため、本番で使うと代金を受け取らずに予約が確定してしまう。
- Stripe に戻すときは `PAYMENTS_MODE=stripe`（または未設定）にして、下の設定と Stripe のキーを入れる。
  stub で作った注文の返金は、そのあとも Stripe を呼ばずに記録だけ行う。stub で登録済みにした貸出主は、
  運営が DB で `stripe_account_id`・`charges_enabled` などを空に戻してから、あらためて Stripe で登録してもらう。

## Connect の設定（ダッシュボード）

1. **Connect → Settings**
   - 連結アカウントの種類：Express
   - 国：日本。事業形態は法人・個人事業主の両方を受け付ける（SPEC 付録 D14。アカウント作成時に事業形態を指定しない）
   - ブランディング（Express のオンボーディング画面に出る名前・アイコン・色）を設定する
2. **入金（payout）**：アカウントを作るときにアプリが `interval: monthly`・`monthly_anchor: 23` を設定する（D15。値は `packages/core/src/config.ts` の `STRIPE_CONNECT`）。
   Connect の設定で、プラットフォームが連結アカウントの入金スケジュールを管理できるようにしておく。

## Webhook

| エンドポイント                                       | 種類                                | イベント                                                              | 署名シークレットの環境変数      |
| ---------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------- | ------------------------------- |
| `https://<利用者サイト>/api/webhooks/stripe-connect` | 連結アカウントのイベント（Connect） | `account.updated`                                                     | `STRIPE_CONNECT_WEBHOOK_SECRET` |
| `https://<利用者サイト>/api/webhooks/stripe`         | アカウントのイベント                | フェーズ6で追加（`payment_intent.succeeded`、`charge.refunded` など） | `STRIPE_WEBHOOK_SECRET`         |

- 署名を検証し、`stripe_events` でイベントの重複処理を防ぐ（`public.claim_stripe_event`）。処理済み・処理中のイベントは 200 を返す。
- 処理に失敗したら 500 を返し、Stripe の再送に任せる。途中で落ちたイベントも、5分後以降の再送で処理し直す。

ローカルでは Stripe CLI で転送する。

```sh
stripe listen --forward-connect-to localhost:3000/api/webhooks/stripe-connect
```

## 冪等性

すべての Stripe API 呼び出しに `idempotencyKey` を付ける（SPEC §7-6）。
連結アカウントの作成は `connect-account:<host_id>` のように操作ごとに決まるキーにし、二重に押しても1つしか作られない。

## 決済の流れ（SPEC §7）

1. 購入手続きで「支払う」を押すと、サーバーが DB 関数 `create_order_from_cart` で注文（pending）・予約（pending）・料金内訳を1つのトランザクションで作る。
   金額は DB 側の料金で計算し直す。他の方が先に予約していれば `slot_taken` になり、予約カゴに戻す。
2. PaymentIntent を Destination charges で作る（カードのみ。付録 D20）。`transfer_data.destination` = 貸出主の連結アカウント、
   `application_fee_amount` = 予約ごとの application fee の合計、`metadata.order_id` = 注文の id。
3. `payment_intent.succeeded` で注文を paid・予約を confirmed にし、charge と transfer の id を保存して確認メールを送る。
   注文完了画面でも PaymentIntent の状態を確かめ、Webhook より先に戻ってきた場合も確定させる（同じ処理なので二重にはならない）。
4. 15分以上 pending の注文は、運営管理の「定期処理」の「支払い期限切れの注文を閉じる」と、購入手続きの始めに expired にし、PaymentIntent を取り消す（付録 D39）。
   それでも期限切れのあとに支払いが成功した場合は、自動で全額返金して利用者に知らせる（付録 D8）。

## キャンセルと返金（SPEC §8・§8.1）

1. DB 関数 `cancel_booking` が、利用者単位の advisory lock を取ったうえで、過去24時間のキャンセル回数の確認・返金区分の判定・
   キャンセルの記録（予約を cancelled にして枠を解放、`cancel_events`・`refunds` の作成）を1つのトランザクションで行う。
2. 返金額が0円でなければ、Stripe で返金と差し戻しを行う（比例配分に任せず金額を明示する）。
   - 返金：`refunds.create`（`amount` = 返金額、`reverse_transfer: false`、`refund_application_fee: false`、`metadata.refund_id`）
   - 差し戻し：`transfers.createReversal`（全額返金は「利用料金 − application fee」、半額返金は「返金額 − 110 × hours」）
3. `charge.refunded` を受け取ったら、Stripe の返金が成功していて差し戻しも済んだものを `refunds.status = succeeded` にし、返金完了のメールを送る。
4. Stripe の処理が失敗したら `refunds.status = failed`（理由を `failure_reason` に残す）。運営管理から再実行する（フェーズ9で画面を作る）。
   再実行のときは、`metadata.refund_id` で Stripe 側に同じ返金・差し戻しがないかを探してから作るので、二重には返金しない。
