# デプロイ手順

前提として、Cloudflareアカウントを持ち、Wranglerでログイン済みである必要があります（`npx wrangler login`）。

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

Worker名は`animaldash`です。公開URLは`animaldash.<アカウントサブドメイン>.workers.dev`形式になります。cloudflare設定が完了するまでは、個人のサブドメインを使用します。

- ゲーム画面: [animaldash.kosei-mochizuki.workers.dev/game](https://animaldash.kosei-mochizuki.workers.dev/game)
- 管理画面: [animaldash.kosei-mochizuki.workers.dev/admin](https://animaldash.kosei-mochizuki.workers.dev/admin)

デプロイに失敗する場合は[開発環境構築のトラブルシュート](./setup.md#トラブルシュート)を確認してください。
