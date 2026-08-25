# 開発環境構築

## 必要な環境

- Git
- Node.js `22.13.0`
- npm

このプロジェクトで使用するNode.jsのバージョンは`22.13.0`です。開発者間でバージョンを合わせるため、nvmでのバージョン管理をおすすめします。macOSでは[nvm](https://github.com/nvm-sh/nvm)、Windowsでは[nvm-windows](https://github.com/coreybutler/nvm-windows)を利用できます。

```bash
nvm install 22.13.0
nvm use 22.13.0
```

## セットアップ手順

```bash
git clone https://github.com/LoGeek-nu/animal-dash.git
cd animal-dash
npm install
npm run dev
```

起動後、次のURLを開きます。

- ゲーム画面: `http://localhost:3000/game`
- 管理画面: `http://localhost:3000/admin`
- ヘルスチェック: `http://localhost:3000/health`

Cloudflareへ公開する場合は、追加でCloudflareアカウントとWranglerのログインが必要です（[デプロイ手順](./deployment.md)を参照）。

## 推奨エディタ設定

VSCodeを使う場合、次の拡張機能を入れておくとコーディング規約に沿った開発がしやすくなります。

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) — `eslint.config.mjs`のReact / React Hooks / jsx-a11y / Next.jsルールを保存時に確認できます。
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) — Tailwind CSSのクラス名補完を有効にします。
- [Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) — ブランチやコミット履歴をグラフで確認できます。[開発フロー](./development-flow.md)の`issue/<番号>-<作業内容>`ブランチと`develop`/`main`の関係を視覚的に把握するのに役立ちます。

## トラブルシュート

| 症状 | 対処 |
| --- | --- |
| `npm install`や`npm run dev`で原因不明のエラーが出る | `node -v`でNode.jsのバージョンが`22.13.0`か確認してください。異なるバージョンでは`vinext`や`wrangler`が正しく動作しないことがあります。 |
| `npm run deploy`や`npm run deploy:dry-run`が認証エラーになる | Wranglerがログインしていない可能性があります。`npx wrangler login`を実行し、Cloudflareアカウントで認証してください。 |
| `npm run dev`でポートが使用中というエラーが出る | 別プロセスが`3000`番ポートを使用しています。該当プロセスを終了するか、既存の`npm run dev`が起動していないか確認してください。 |

---

[目次に戻る](../README.md#ドキュメント目次)
