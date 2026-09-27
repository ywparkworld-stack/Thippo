# E2E テストの準備（GitHub の Secrets）

E2E テスト（`.github/workflows/e2e.yml`）は、Stripe のテストモードの情報を3つ使う。
テストモードの情報なので、実際のお金は動かない。**本番モードのキー（`sk_live_` で始まるもの）は絶対に登録しない。**

| Secret の名前                      | 値                        | どこで手に入れるか |
| ---------------------------------- | ------------------------- | ------------------ |
| `STRIPE_TEST_PUBLISHABLE_KEY`      | `pk_test_` で始まる文字列 | 手順 1             |
| `STRIPE_TEST_SECRET_KEY`           | `sk_test_` で始まる文字列 | 手順 1             |
| `STRIPE_TEST_CONNECTED_ACCOUNT_ID` | `acct_` で始まる文字列    | 手順 2             |

## 1. Stripe のテストモードの API キー

1. https://dashboard.stripe.com にログインする（アカウントがなければ作る。テストモードだけなら本人確認は不要）。
2. 画面右上の「テストモード」（Test mode）をオンにする。
3. 「開発者」（Developers）→「API キー」（API keys）を開く。
4. 「公開可能キー」（Publishable key、`pk_test_…`）と「シークレットキー」（Secret key、`sk_test_…`。「表示」を押すと見える）を控える。

## 2. テスト用の連結アカウント（貸出主の代わり）

1. テストモードのまま「Connect」を開く。初めてなら Connect の利用を開始する（プラットフォームの種類は「マーケットプレイス」を選ぶ）。
2. 「連結アカウント」（Connected accounts）→「＋作成」（Create）。
3. アカウントの種類は **Express**、国は **日本** を選んで作成する。
4. 表示されるオンボーディングのリンクを開き、テスト用の値で最後まで入力する（テストモードでは「テストデータを使用」のボタンや、画面に表示されるテスト用の電話番号・確認コード・口座番号が使える）。
5. 連結アカウントの一覧で、作ったアカウントの「支払い」「入金」が有効（Enabled）になっていることを確かめ、アカウント ID（`acct_…`）を控える。

## 3. GitHub に登録する

1. GitHub でこのリポジトリを開き、「Settings」→ 左のメニューの「Secrets and variables」→「Actions」を開く。
2. 「New repository secret」を押し、Name に上の表の名前、Secret に値を貼り付けて「Add secret」。3つとも登録する。

登録が済むと、プルリクエストを作ったときに E2E が自動で実行される（Secrets がない間は実行されずにスキップされる）。
