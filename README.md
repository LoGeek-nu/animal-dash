# ANIMAL DASH! v0.5.5 モック

桜麗祭向け「手描きキャラクター・2Dレースゲーム」の操作検証用モックです。来場者向けゲーム画面とスタッフ管理画面を別タブで開くと、キャラクター割り当てやフェーズ変更が即時同期します。

## 起動

Node.js 22.13 以降で以下を実行します。

```bash
npm install
npm run dev
```

- ゲーム画面: `http://localhost:3000/game`
- 管理画面: `http://localhost:3000/admin`
- ヘルスチェック: `http://localhost:3000/health`

## モックで試せること

- 来場者を呼び込むアトラクト画面（キャラクターパレード → 3ステップ遊び方 → 当日TOP10の約41秒上映）
- 管理画面からのアトラクト再生・参加待機画面への手動遷移
- 手描きクレヨン／絵の具調に統一した、全身・横向きの動物ランナー10体
- 登録済み10キャラクターの検索・選択・解除
- キャラクターカードを管理画面右側のレーンへドラッグ＆ドロップして割り当て（右側へ入った時だけ反応）
- 最大4レーンへの割り当てとBOT補充
- `BroadcastChannel` と `localStorage` を使ったタブ間リアルタイム同期
- 3秒カウントダウン、4レーンの自動スクロールレース
- キーボード／Gamepad APIによるジャンプと加速
- 5区間の手描きコース、描き込み付きの6障害物、接地影・加速・衝突演出、順位・タイム
- リザルト、日別TOP3、90秒後のアトラクト画面への自動復帰
- スタッフによる強制終了・スキップ・リセット
- サンプルAPI `/api/characters` と `/api/rankings`

キーボードはレーン順に、レーン1が `Space / Shift`、レーン2が `↑ / Enter`、レーン3が `W / E`、レーン4が `I / O` です。各組の左がジャンプ、右が加速です。

ゲーム画面は初回起動時にアトラクト表示から始まります。参加者を登録しても画面は切り替わらず、スタッフが管理画面の「参加待機画面」を押したときだけ参加待機へ進みます。

## 実装範囲

本成果物はフロントエンド体験の検証を目的とした、JavaScript／JSXのみのモックです。アプリ内認証はなく、ゲーム画面と管理画面を直接開けます。管理画面をインターネット公開する場合は、運用前に別途アクセス制御を追加してください。

Durable Objects、D1、R2は接続せず、ブラウザの `BroadcastChannel` と `localStorage` で状態を共有しています。セッションのReducer、保存、タブ間同期、フェーズタイマーを分離しているため、本実装へ移行する際は `app/features/race-session/` のStorage・Channel境界を差し替えられます。

## コード構成

- `app/components/ui/`: Atomic Designに基づく共通Atoms・Molecules・Organisms
- `app/features/game/`: ゲーム画面、フェーズScreen、レースエンジン
- `app/features/admin/`: 管理画面、ドラッグ＆ドロップ、キャラクター選択
- `app/features/race-session/`: Reducer、永続化、タブ間同期、タイマー
- `app/domain/`: キャラクター、コース、ランキング、アトラクト設定
- `app/styles/`: 共通、ゲーム各Screen、管理画面、レスポンシブのスタイル

`/game` 内のフェーズ切替はURLルーティングではなく、静的importされたScreenの状態切替です。フェーズ移行時に追加のページ読込は発生しません。

## 検証

```bash
npm run build
npm run lint
npm test
```

## Cloudflare Workersへの公開

ChatGPT Sitesは使用せず、Cloudflare Workersへ直接デプロイします。Cloudflareへログインした環境で実行してください。

```bash
npm run deploy:dry-run
npm run deploy
```

Worker名は`animaldash`です。公開URLはCloudflareの仕様により`animaldash.<アカウントサブドメイン>.workers.dev`形式になります。設定は`wrangler.jsonc`、生成された実行設定は`dist/server/wrangler.json`で確認できます。

- ゲーム画面: [animaldash.kosei-mochizuki.workers.dev/game](https://animaldash.kosei-mochizuki.workers.dev/game)
- 管理画面: [animaldash.kosei-mochizuki.workers.dev/admin](https://animaldash.kosei-mochizuki.workers.dev/admin)
