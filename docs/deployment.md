# デプロイ手順

前提として、Wranglerで`logeek.tech`のCloudflareアカウント（`bd6022bab607c76f306d3a313431d8f6`）にログイン済みである必要があります。`npx wrangler whoami`でアカウントIDを確認し、異なる場合は`npx wrangler login`で対象アカウントにログインしてください。

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
