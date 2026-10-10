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

来場者のイラストは、[animal-dash-image-poc](https://github.com/minmmmmin/animal-dash-image-poc)と連携してキャラクターへ変換します。画像はR2、キャラクター情報・確定レース結果はD1へ保存し、日次ランキングは日本時間の最速記録から集計します。静的キャラクターの画像は`public/characters/`を使用します。

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
- [D1とランキングの仕様](./docs/race-storage.md) — DB導入、R2からの取り込み、結果保存、取得API
- [クリアタイム計測の仕様](./docs/race-timing.md) — レースID、開始時刻、タイム確定、DNF、保存への受け渡し
- [ランキング表示の仕様](./docs/ranking-display.md) — 実データのTOP 3／TOP 10、保存待ち、取得状態

## クイックスタート

必要な環境: Git / Node.js `22.13.0` / npm（詳細は[開発環境構築](./docs/setup.md)を参照）

```bash
git clone https://github.com/LoGeek-nu/animal-dash.git
cd animal-dash
npm install
npm run db:migrate:local
npm run dev
```

起動後、次のURLを開きます。

- ゲーム画面: `http://localhost:3000/game`
- 管理画面: `http://localhost:3000/admin`
- ヘルスチェック: `http://localhost:3000/health`

## 本番反映の手順（D1導入・ランキング対応）

今回の取り込み順は **[PR #49 / Issue #45](https://github.com/LoGeek-nu/animal-dash/pull/49) → [PR #48 / Issue #44](https://github.com/LoGeek-nu/animal-dash/pull/48) → [PR #50 / Issue #46](https://github.com/LoGeek-nu/animal-dash/pull/50)** です。まず#49を`develop`へ取り込み、#48のbaseを`develop`へ変更して取り込み、最後に#50のbaseを`develop`へ変更して取り込みます。後続PRの差分に前段が重複しないことを確認してください。Squash/Rebase mergeを使った場合は後続ブランチのrebaseも必要です。3つすべてを取り込んでから、[本番リリースフロー](./docs/release-flow.md)に従って`develop`を`main`へマージし、以下を実行します。

1. **レースを止め、対象を確認する。** 進行中のレースを終了させ、反映完了まで新規レースを開始しません。対象はCloudflareアカウント`bd6022bab607c76f306d3a313431d8f6`、Worker `animaldash`、R2 `animaldash-characters`、D1 `animaldash-races`です。

   ```bash
   npx wrangler whoami
   npx wrangler d1 list
   ```

2. **D1を紐付ける（初回のみ）。** 既存の`animaldash-races`があればそのUUIDを使います。存在しない場合だけ作成します。

   ```bash
   npx wrangler d1 create animaldash-races
   ```

   出力のUUIDを`wrangler.jsonc`の`d1_databases`内へ`database_id`として追加します。DB名だけでデプロイせず、既存DBのUUIDを明示してください。設定変更はGitにも反映します。R2が未作成の場合だけ`npx wrangler r2 bucket create animaldash-characters`を実行します。

3. **シークレットを確認する。** `npx wrangler secret list`で`STAFF_PASSCODE`、`IMAGE_POC_API_URL`、`IMAGE_POC_API_KEY`が登録済みか確認し、不足分だけ`npx wrangler secret put <名前>`で登録します。値はコマンド引数・Git・ログに書きません。ローカルの`.dev.vars`は自動では本番へ反映されません。

4. **既存DBをバックアップして、本番マイグレーションを適用する。** バックアップはGit管理外に保存します。新規DBに記録がない場合はバックアップを省略できます。

   ```bash
   mkdir -p .wrangler/backups
   npx wrangler d1 export animaldash-races --remote --output .wrangler/backups/animaldash-races-before-migration.sql
   npx wrangler d1 migrations list animaldash-races --remote --config wrangler.jsonc
   npm run db:migrate:remote
   ```

   初回は`0001_race_storage.sql`（テーブル・制約・インデックス）と`0002_builtin_characters.sql`（静的10体）が適用されます。以後も新しいmigrationを**Workerの反映より先に**適用します。`npm run db:migrate:local`では本番DBは初期化されません。Workerのデプロイだけでもmigrationは実行されません。

5. **本番設定で検証してデプロイする。** UUIDを設定した状態でビルドします。

   ```bash
   npm ci
   npm run lint
   npm test
   npm run deploy:dry-run
   npm run deploy
   ```

   dry-runの成功は本番のDB初期化や疎通を保証しません。`dist/server/wrangler.json`は生成物なので直接編集しません。

6. **既存R2キャラクターをD1へ取り込む（初回・復旧時）。** 本番の[ログイン画面](https://animaldash.logeek.tech/login)からスタッフログインし、同じサイトの開発者コンソールで実行します。

   ```js
   await (async () => {
     let cursor;
     do {
       const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
       const response = await fetch(`/api/characters/import${query}`, { method: "POST" });
       if (!response.ok) throw new Error(`取り込み失敗: ${response.status}`);
       const page = await response.json();
       console.log(page); // imported / skipped / cursor / done
       cursor = page.cursor;
     } while (cursor);
   })();
   ```

   取り込み完了・`skipped`の内容を確認します。同じIDへのupsertのため再実行可能です。既存キャラクターは取り込まれるまで一覧に現れません。画像はR2に残り、再生成は不要です。

7. **すべての管理・ゲーム画面を再読み込みする。** 同期プロトコルが変わるため、古いタブを残しません。まず[ゲーム画面](https://animaldash.logeek.tech/game)を開き、[管理画面](https://animaldash.logeek.tech/admin)から開始します。ゲーム画面未接続では開始を受理しません。複数のゲーム画面がある場合は最初の接続が操作の報告元となり、切断後の再接続では接続中のゲーム画面へ引き継ぎます。

8. **本番の疎通を確認して運用を再開する。** `/health`、`/api/characters`、`/api/rankings`が成功することを確認し、テストレースを自然完走させます。画面の順位・タイムと以下の本番D1の保存値を照合し、BOT・DNFのランキング除外も確認します。本番のテストレースは実際に記録へ残ります。

   ```bash
   npx wrangler d1 execute animaldash-races --remote --config wrangler.jsonc --command "SELECT r.id, rr.character_id, rr.rank, rr.finish_ms, rr.is_bot FROM races r JOIN race_results rr ON rr.race_id=r.id ORDER BY r.started_at DESC, rr.rank LIMIT 20"
   ```

保存エラーはWorkers Logsの`race_save_failed`で確認します。一時的なDB障害は再試行しますが、結果競合などの恒久エラーはDurable Objectの`failed:<raceId>`へ隔離し、再試行を止めて画面へ失敗を通知します。隔離記録を確認して原因を修復してください。WorkerコードのロールバックだけではD1/R2のデータやmigrationは戻りません。詳細は[デプロイ手順](./docs/deployment.md)と[D1の仕様](./docs/race-storage.md)を参照してください。

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
