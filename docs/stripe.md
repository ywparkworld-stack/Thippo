# Stripe の設定

決済は Stripe Connect（Express アカウント、Destination charges）。development と staging はテストモードのキーを使う。

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
