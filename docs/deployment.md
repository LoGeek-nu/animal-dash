# デプロイ手順

前提として、Wranglerで`logeek.tech`のCloudflareアカウント（`bd6022bab607c76f306d3a313431d8f6`）にログイン済みである必要があります。`npx wrangler whoami`でアカウントIDを確認し、異なる場合は`npx wrangler login`で対象アカウントにログインしてください。

## 初回のみ: R2バケットの作成

生成キャラクターの保存先として、R2バケット`animaldash-characters`が必要です。アカウントごとに一度だけ作成します。

```bash
npx wrangler r2 bucket create animaldash-characters
```

ローカル開発（`npm run dev`）ではWranglerのローカルR2が自動で使われるため、この作成は不要です。

## D1の接続先確認とマイグレーション

本番D1 `animaldash-races`は作成済みで、`wrangler.jsonc`の`d1_databases`には`database_id`（`b2fdef8d-f99e-45d3-ba75-17caf4deba80`）を固定しています。各自でDBを作成したりUUIDを追加したりする必要はありません。

```bash
npx wrangler d1 info animaldash-races --config wrangler.jsonc
```

DBの名前・UUIDが設定と一致することを確認します。一致しない場合はマイグレーションやデプロイを進めず、ログイン先と設定を確認してください。別のDBへ変更する場合は`wrangler.jsonc`を更新し、PRで接続先の変更をレビューします。

Workerのビルド・デプロイより先に、スキーマと静的キャラクターを本番D1へ反映します。以後もマイグレーション追加時に実行します。

```bash
npm run db:migrate:remote
```

ローカル確認では`npm run db:migrate:local`を使います。本番用の`database_id`が設定されていても、`--local`を使うローカルマイグレーションは本番DBを更新しません。マイグレーションはWorkerのデプロイだけでは実行されません。

既存R2キャラクターはデプロイ後にスタッフログインし、[取り込み手順](./race-storage.md#既存r2キャラクターの取り込み)でD1へ登録します。取り込まれるまで生成キャラクターは一覧に表示されません。

## 初回のみ: シークレットの登録

本番のWorkerには次のシークレットが必要です。値はリポジトリに書かず、Wranglerで登録します。

```bash
npx wrangler secret put STAFF_PASSCODE      # 管理画面の合言葉
npx wrangler secret put GAME_PASSCODE       # ゲーム画面を操作する合言葉（管理用とは別にする）
npx wrangler secret put IMAGE_POC_API_URL
npx wrangler secret put IMAGE_POC_API_KEY
```

`STAFF_PASSCODE`が未登録のままだと、管理操作に使う同期接続とキャラクター生成はすべて拒否されます。`GAME_PASSCODE`が未登録のままだと、どの端末もゲーム画面を操作できません（管理用の合言葉でログインしていても、`/game`は観戦になります）。新しく`GAME_PASSCODE`を登録するときは、デプロイより先に登録してください。観戦用の同期（`/api/sync?role=viewer`）はログイン不要で接続できます。合言葉は推測されにくい長めのものにし、当日はスタッフ間で口頭などで共有してください。変更すると、ログイン済みの端末も全てログアウトされます。

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

デプロイ前に内容を確認します。Cloudflareへは反映されません。ビルド後の`dist/server/wrangler.json`にも、`wrangler.jsonc`と同じ`database_id`が引き継がれます。生成物は直接編集せず、接続先の変更は`wrangler.jsonc`で行ってください。

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
