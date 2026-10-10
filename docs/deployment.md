# デプロイ手順

前提として、Wranglerで`logeek.tech`のCloudflareアカウント（`bd6022bab607c76f306d3a313431d8f6`）にログイン済みである必要があります。`npx wrangler whoami`でアカウントIDを確認し、異なる場合は`npx wrangler login`で対象アカウントにログインしてください。

## 初回のみ: R2バケットの作成

生成キャラクターの保存先として、R2バケット`animaldash-characters`が必要です。アカウントごとに一度だけ作成します。

```bash
npx wrangler r2 bucket create animaldash-characters
```

ローカル開発（`npm run dev`）ではWranglerのローカルR2が自動で使われるため、この作成は不要です。

## 初回のみ: シークレットの登録

本番のWorkerには次のシークレットが必要です。値はリポジトリに書かず、Wranglerで登録します。

```bash
npx wrangler secret put STAFF_PASSCODE      # スタッフログインの合言葉
npx wrangler secret put IMAGE_POC_API_URL
npx wrangler secret put IMAGE_POC_API_KEY
```

`STAFF_PASSCODE`が未登録のままだと、同期（`/api/sync`）とキャラクター生成はすべて拒否されます。合言葉は推測されにくい長めのものにし、当日はスタッフ間で口頭などで共有してください。変更すると、ログイン済みの端末も全てログアウトされます。

### 回数制限

追加の設定は不要です（`wrangler.jsonc`に含まれています）。

| 対象 | 上限 | 超えたとき |
|---|---|---|
| キャラクター生成（`POST /api/characters/generate`） | 全端末の合計で、どの60秒をとっても10回まで | 429。画面に「○秒ほど待ってから」と表示 |
| ログイン（`POST /api/auth`） | IPごとに1分20回まで | 429。画面に「1分ほど待ってから」と表示 |

- 生成の上限は、Gemini（ステータス生成）の上限15回/分に余裕を持たせた値です。数え方の都合で、Durable Object（`GenerationQuota`）で直近60秒の回数を数えています。Geminiの枠を増やしたときは、`worker/generation-quota.js`の`GENERATION_LIMIT`を変更してください。
- Geminiの1日の上限（500回）はアプリでは止めていません。足りなくなったらGemini側で枠を増やしてください。
- 会場の端末は同じ回線（同じIP）になるため、ログインの20回は全端末の合計です。

## 1. デプロイ内容の確認（dry-run）

デプロイ前に内容を確認します。Cloudflareへは反映されません。

```bash
npm run deploy:dry-run
```

## 2. デプロイ

問題がなければCloudflare Workersへ反映します。

```bash
npm run deploy
```

## 公開先

Worker名は`animaldash`です。公開先はCloudflareゾーン`logeek.tech`のカスタムドメイン`animaldash.logeek.tech`です。Wranglerによるデプロイ時に、このドメインのDNSレコードと証明書がCloudflareで設定されます。

- ゲーム画面: [animaldash.logeek.tech/game](https://animaldash.logeek.tech/game)
- 管理画面: [animaldash.logeek.tech/admin](https://animaldash.logeek.tech/admin)

デプロイに失敗する場合は[開発環境構築のトラブルシュート](./setup.md#トラブルシュート)を確認してください。

---

[目次に戻る](../README.md#ドキュメント目次)
