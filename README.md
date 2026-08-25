# アニマルダッシュ — 2026 桜麗祭企画

来場者に動物のイラストを描いてもらい、その動物がゲーム内のレースに参加する参加型ゲームです。当日はプロジェクターでレースを大画面に映し、絵を描いた参加者だけでなく周りの来場者も一緒に観戦して楽しめる企画を目指しています。

| 項目 | 内容 |
| --- | --- |
| イベント | 第34回 桜麗祭 |
| 開催日 | 2026年10月31日（土）・11月1日（日） |
| 会場 | 3501教室 |
| 団体 | 日本大学文理学部情報研究会LoGeek |
| 参加部門 | 展示部門 |
| 出展企画 | アニマルダッシュ |

企画全体の進行状況や当日の運営・装飾タスクなどは[Notion](https://app.notion.com/p/logeek/37f4072687e180b4a19bc9f5a178a1b3)で管理しています。このリポジトリはゲーム・システム開発部分を扱います。

## ドキュメント目次

### はじめに

- [使用技術一覧](./docs/tech-stack.md) — プロジェクトで使用している技術スタック
- [開発環境構築](./docs/setup.md) — ローカル開発環境のセットアップ手順

### 開発

- [開発ガイドライン](./docs/development-guide.md) — コマンド、ゲームドメイン用語集、テスト構成
- [ディレクトリ構成](./docs/directory-structure.md) — プロジェクトのディレクトリ構造
- [開発フロー](./docs/development-flow.md) — Issue作成からPRマージまでの手順
- [本番リリースフロー](./docs/release-flow.md) — develop確認から本番反映までの手順

### デプロイ

- [デプロイ手順](./docs/deployment.md) — Cloudflare Workersへのデプロイ方法

## クイックスタート

必要な環境: Git / Node.js `22.13.0` / npm（詳細は[開発環境構築](./docs/setup.md)を参照）

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

## 設計資料

実装計画は[`doc/README.md`](./doc/README.md)に一覧化しています。初期計画をv1として、追加修正の内容をバージョンごとに保存しています。
これらはモック作成時の設計記録です。通常の機能変更に合わせて`doc/`を都度更新する必要はありません。

| 呼称 | バージョン | 内容 |
| --- | --- | --- |
| v1 | 0.1 | 初期モック、画面、レース、Cloudflare構成 |
| v2 | 0.2 | アトラクト画面、手描きテイスト、全身ランナー |
| v3 | 0.3 | JavaScript／JSX化、認証撤去、管理画面とコース改善 |
| v4 | 0.4 | ドラッグ＆ドロップ、各ゲーム画面、待機画面改善 |
| v5 | 0.5.0 | Atomic Designを重視したコンポーネント分割 |
| v5.5 | 0.5.5 | Cloudflare Workersへの移行 |
