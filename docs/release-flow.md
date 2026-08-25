# 本番リリースフロー

日々の開発は[開発フロー](./development-flow.md)のとおり`develop`上で進めます。本番（`main`）への反映は次の手順で行います。

## 1. `develop`での動作確認

`develop`にマージされた変更を、本番反映前にローカルまたはdev環境で確認します。

```bash
npm run lint
npm test
npm run preview
```

`npm run preview`はビルド後にWranglerで起動するため、Cloudflare Workers上の挙動に近い状態で確認できます。

## 2. `main`へのマージ

`develop`の内容に問題がなければ、`develop`から`main`へマージします。直接`main`へコミットはしません。

## 3. デプロイ

`main`へのマージ後、[デプロイ手順](./deployment.md)に沿ってCloudflare Workersへ反映します。

---

[目次に戻る](../README.md#ドキュメント目次)
