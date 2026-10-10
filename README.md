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

## 本番反映

PRの取り込み順は **[PR #49 / Issue #45](https://github.com/LoGeek-nu/animal-dash/pull/49) → [PR #48 / Issue #44](https://github.com/LoGeek-nu/animal-dash/pull/48) → [PR #50 / Issue #46](https://github.com/LoGeek-nu/animal-dash/pull/50)** です。前段を取り込んだら、次のPRのbaseを`develop`へ変更して差分の重複がないことを確認します。Squash/Rebase mergeの場合は後続ブランチのrebaseも必要です。3PRすべてを取り込んだ後、[リリースフロー](./docs/release-flow.md)に従って`develop`を`main`へマージします。

本番の対象はWorker `animaldash`、D1 `animaldash-races`、R2 `animaldash-characters`、Cloudflareアカウント`bd6022bab607c76f306d3a313431d8f6`です。

### 初回導入だけ行うこと

**1. D1を作成し、UUIDを設定する。**

```bash
npx wrangler whoami
npx wrangler d1 list
```

対象アカウントであることを確認します。`animaldash-races`が既にあればそのUUIDを使います。存在しない場合だけ作成します。

```bash
npx wrangler d1 create animaldash-races
```

出力されたUUIDを`wrangler.jsonc`の`d1_databases`内の`database_id`に設定し、設定変更をGitへ反映します。DB名だけの設定でデプロイせず、使用するDBのUUIDを明示してください。

**2. R2とシークレットを準備する。**

R2が未作成の場合だけ実行します。

```bash
npx wrangler r2 bucket create animaldash-characters
```

`npx wrangler secret list`で登録済みの名前を確認します。不足しているものだけ、次のコマンドで登録します。

```bash
npx wrangler secret put STAFF_PASSCODE
npx wrangler secret put IMAGE_POC_API_URL
npx wrangler secret put IMAGE_POC_API_KEY
```

値はコマンド引数・Git・ログに書きません。`.dev.vars`は本番へ自動反映されません。

**3. 初回のマイグレーションとデプロイを行う。**

```bash
npm ci
npm run lint
npm test
npm run db:migrate:remote
npm run deploy:dry-run
npm run deploy
```

`0001_race_storage.sql`でテーブル・制約・インデックス、`0002_builtin_characters.sql`で静的10体を登録します。既存DBに記録がある場合は、適用前に下の通常更新手順のバックアップを取得してください。

**4. デプロイ後、既存R2キャラクターをD1へ取り込む。**

本番の[ログイン画面](https://animaldash.logeek.tech/login)からスタッフログインし、同じサイトの開発者コンソールで実行します。

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

取り込み完了と`skipped`の内容を確認します。画像はR2に残り、再生成は不要です。既存キャラクターは取り込まれるまで一覧に表示されません。完了後は、下の「画面を再読み込みして疎通を確認する」を実施します。

### 通常の本番更新で毎回行うこと

DB・R2の作り直し、シークレットの再登録、既存キャラクターの取り込みは通常更新では不要です。

**1. 反映するコードと対象を確認し、レースを止める。**

`main`にリリース対象がマージ済みであることを確認します。進行中のレースを終了させ、疎通確認が終わるまで新規レースを開始しません。

```bash
npx wrangler whoami
npm ci
npm run lint
npm test
```

**2. 本番DBをバックアップする。**

```bash
mkdir -p .wrangler/backups
npx wrangler d1 export animaldash-races --remote --output .wrangler/backups/animaldash-races-before-migration.sql
```

バックアップ先はGit管理外です。前回分も残す場合はファイル名に日時を付けます。

**3. 未適用のマイグレーションを適用する。**

```bash
npx wrangler d1 migrations list animaldash-races --remote --config wrangler.jsonc
npm run db:migrate:remote
```

適用済みファイルは再実行されません。Workerの更新より先にDBを更新します。`db:migrate:local`では本番DBは更新されません。

**4. デプロイする。**

```bash
npm run deploy:dry-run
npm run deploy
```

UUIDを設定した状態でビルド・デプロイします。`dist/server/wrangler.json`は生成物なので直接編集しません。dry-runだけでは本番のDB疎通は確認できません。

**5. 画面を再読み込みして疎通を確認する。**

すべての管理・ゲーム画面を再読み込みします。今回の変更では同期プロトコルが変わるため、古いタブを残さないでください。先に[ゲーム画面](https://animaldash.logeek.tech/game)を開き、その後[管理画面](https://animaldash.logeek.tech/admin)から開始します。

- `/health`、`/api/characters`、`/api/rankings`が成功することを確認する。
- テストレースを自然完走させ、画面の順位・タイムとD1の値を照合する。
- BOT・DNFは出走履歴へ残り、日次ランキングには含まれないことを確認する。

```bash
npx wrangler d1 execute animaldash-races --remote --config wrangler.jsonc --command "SELECT r.id, rr.character_id, rr.rank, rr.finish_ms, rr.is_bot FROM races r JOIN race_results rr ON rr.race_id=r.id ORDER BY r.started_at DESC, rr.rank LIMIT 20"
```

本番のテストレースは記録へ残ります。確認が通ったら通常運用を再開します。

### 障害時の復旧

一時的なDB障害は保存を再試行します。結果競合などの恒久エラーはDurable Objectの`failed:<raceId>`へ隔離して再試行を止め、画面へ保存失敗を通知します。Workers Logsの`race_save_failed`と隔離記録を確認して原因を修復してください。

生成時にR2保存だけ成功してD1保存が失敗した場合は、初回導入の取り込み手順を再実行できます。同じIDへのupsertなので重複登録しません。

WorkerコードのロールバックだけではD1/R2のデータやmigrationは戻りません。詳細は[デプロイ手順](./docs/deployment.md)と[D1の仕様](./docs/race-storage.md)を参照してください。

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
