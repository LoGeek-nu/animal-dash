# ANIMAL DASH! 追加修正実装計画 v0.5.5

- 文書バージョン: 0.5.5
- 作成日: 2026-08-19
- 対象: v0.5 JavaScript／JSXモックの公開基盤
- 主目的: ChatGPT Sitesを廃止し、Cloudflare Workersの`workers.dev`へ直接公開する

## 1. 背景

v0.5までは`@openai/sites-vite-plugin`と`.openai/hosting.json`を利用し、`chatgpt.site`へ公開していた。v0.5.5では画面、ゲームロジック、認証なしの運用方針を維持したまま、公開経路だけをCloudflare Workersへ切り替える。

Cloudflareの`workers.dev` URLは`<Worker名>.<アカウントサブドメイン>.workers.dev`形式で発行される。Worker名は`animaldash`とし、実際の公開URLはデプロイ結果を正とする。

## 2. 実装方針

### 2.1 Sites依存の撤去

- `@openai/sites-vite-plugin`を依存関係から削除する。
- Vite設定から`sites()`と`.openai/hosting.json`の読み込みを削除する。
- `.openai/hosting.json`を削除し、以後の公開コマンドからChatGPT Sitesを完全に外す。
- D1、R2、認証用の仮バインディングは追加しない。

### 2.2 Workers設定の一本化

- ルートに`wrangler.jsonc`を追加する。
- Worker名を`animaldash`、`workers_dev`を`true`に固定する。
- 意図しない公開URLを増やさないため`preview_urls`は`false`にする。
- 互換日付は実装日である`2026-08-19`とし、`nodejs_compat`を有効にする。
- `dist/client`を静的アセットとして配信し、SSR／Route HandlerはWorker entryへ委譲する。
- `ASSETS` bindingのみを使用し、未使用のCloudflare Images bindingは設けない。
- Workers LogsとTracesを有効にし、公開後の障害調査経路を確保する。

### 2.3 ビルド・公開コマンド

- vinextと同一系列の`@vinext/cloudflare`を導入する。
- `npm run start`: 生成済みWorkerをWranglerでローカル起動する。
- `npm run preview`: ビルド後にローカルWorkerを起動する。
- `npm run deploy:dry-run`: Cloudflare構成を非公開のまま検証する。
- `npm run deploy`: ビルドし、Wrangler経由で`workers.dev`へ公開する。

## 3. 非対象

- ゲーム画面、管理画面、Atomic Design構成、レースロジックの変更
- 認証、Cloudflare Access、Turnstileの追加
- Durable Objects、D1、R2、KVへの状態移行
- 独自ドメインの割り当て
- 旧ChatGPT Sites側のプロジェクト削除

旧Sitesプロジェクトは外部資産の破壊を避けるため削除せず、コードと今後のデプロイ経路からのみ切り離す。

## 4. 実装手順

1. SitesプラグインとHosting設定を除去する。
2. Cloudflare公式のvinextアダプターと`wrangler.jsonc`を追加する。
3. Worker entryから未使用の画像最適化binding依存を除去する。
4. デプロイ設定の回帰テストを追加する。
5. lint、単体テスト、production build、Wrangler dry-runを実行する。
6. `animaldash` Workerを`workers.dev`へデプロイする。
7. `/game`、`/admin`、`/health`と主要静的アセットを公開URLで確認する。

## 5. 受け入れ条件

- リポジトリ内の実行設定に`@openai/sites-vite-plugin`、`.openai/hosting.json`、`chatgpt.site`参照が残っていない。
- `wrangler.jsonc`のWorker名が`animaldash`、`workers_dev`が`true`である。
- `npm run lint`、`npm test`、`npm run deploy:dry-run`が成功する。
- Cloudflareが発行した`animaldash.<アカウントサブドメイン>.workers.dev`で`/game`と`/admin`がHTTP 200を返す。
- `/health`がHTTP 200と`{"status":"ok"}`を返す。
- 認証画面や認証処理を追加せず、ゲーム画面と管理画面を直接開ける。

## 6. 実装結果

- 公開URL: `https://animaldash.kosei-mochizuki.workers.dev`
- Cloudflare Version ID: `1d7df175-2878-4cfc-ab7e-3392cb75e9a8`
- `npm run lint`: 成功
- `npm test`: 16件成功、失敗0件
- `npm run deploy:dry-run`: 成功
- `/game`: HTTP 200、実ブラウザ描画成功、warning/errorログ0件
- `/admin`: HTTP 200、実ブラウザ描画成功、画像エラー0件、warning/errorログ0件
- `/health`: HTTP 200、`status: ok`
- `/api/characters`: HTTP 200
- キャラクターPNGとデモMP4: HTTP 200

Cloudflareへの初回アセット転送では一時的な通信失敗により自動リトライが3回発生したが、40/40ファイルのアップロード後にWorker本体とトリガーの公開が完了した。公開後の全確認項目は正常である。
