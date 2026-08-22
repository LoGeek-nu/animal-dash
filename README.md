# アニマルダッシュ — 2026 桜麗祭企画

## ゲーム概要

来場者に動物のイラストを描いてもらい、その動物がゲーム内のレースに参加する参加型ゲームです。

## 技術選定

- [JavaScript / JSX](https://developer.mozilla.org/ja/docs/Web/JavaScript) — アプリケーション全体を記述しています。TypeScriptは使用していません。
- [React 19](https://react.dev/) — ゲーム画面と管理画面のUI、状態に応じた画面更新に使用しています。
- [Vinext](https://github.com/cloudflare/vinext) — Next.jsのApp Router形式をViteとCloudflare Workers上で動かすための互換レイヤーです。`app/`以下のルーティングやReact Server Componentsのビルドを担当します。現在はベータ版のため、更新時にはビルドと画面表示の確認が必要です。
- [Vite 8](https://vite.dev/) — ローカル開発サーバーと本番ビルドに使用しています。設定は`vite.config.js`にあります。
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — 公開環境です。Workerの設定は`wrangler.jsonc`、起動処理は`worker/index.js`にあります。
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) — Cloudflare Workersのローカル起動、ビルド結果の確認、デプロイに使用するCLIです。
- [dnd kit](https://dndkit.com/) — 管理画面でキャラクターをレーンへ割り当てるドラッグ＆ドロップ操作に使用しています。
- [Tailwind CSS 4](https://tailwindcss.com/) / CSS — Tailwind CSSをCSS処理の基盤として読み込み、画面固有の見た目は主に`app/styles/`以下の通常のCSSで管理しています。
- React Reducer — レースセッションの状態遷移を一か所にまとめるために使用しています。処理は`app/features/race-session/`以下にあります。
- [`localStorage`](https://developer.mozilla.org/ja/docs/Web/API/Window/localStorage) — レーン割り当てやゲームフェーズなど、モックの状態をブラウザ内に保存します。
- [`BroadcastChannel`](https://developer.mozilla.org/ja/docs/Web/API/BroadcastChannel) — 同じブラウザで開いたゲーム画面と管理画面の状態をリアルタイムに同期します。
- [Node.js Test Runner](https://nodejs.org/api/test.html) — ドメインロジック、画面レンダリング、デプロイ設定の自動テストに使用しています。
- [ESLint](https://eslint.org/) — JavaScript / JSXの静的チェックに使用しています。

このリポジトリは現在、操作検証用のモックとして実装されています。認証、D1、Durable Objects、R2などのサーバー側データ管理は実装していません。ゲーム状態はブラウザ内に保存されるため、別の端末やブラウザとは共有されません。

`/game`内のフェーズ切り替えはURLルーティングではありません。あらかじめ読み込まれた画面コンポーネントを状態に応じて切り替えるため、フェーズ変更のたびに別ページを読み込むことはありません。

## 必要な環境

- Node.js 22.13以降
- npm

Cloudflareへ公開する場合は、追加でCloudflareアカウントとWranglerのログインが必要です。

## ローカル起動

```bash
npm install
npm run dev
```

起動後、次のURLを開きます。

- ゲーム画面: `http://localhost:3000/game`
- 管理画面: `http://localhost:3000/admin`
- ヘルスチェック: `http://localhost:3000/health`

キーボード操作は次のとおりです。各レーンの左側がジャンプ、右側が加速です。

| レーン | ジャンプ | 加速 |
| --- | --- | --- |
| 1 | `Space` | `Shift` |
| 2 | `↑` | `Enter` |
| 3 | `W` | `E` |
| 4 | `I` | `O` |

## 開発用コマンド

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | ローカル開発サーバーを起動する |
| `npm run build` | Cloudflare Workers向けの公開ファイルを生成する |
| `npm run start` | ビルド済みファイルをWranglerで起動する |
| `npm run preview` | ビルド後にWranglerで起動する |
| `npm run lint` | ESLintでコードを検査する |
| `npm test` | ビルド後に全テストを実行する |
| `npm run deploy:dry-run` | デプロイ内容をCloudflareへ反映せず確認する |
| `npm run deploy` | Cloudflare Workersへデプロイする |

変更をマージする前に、最低限次のコマンドを実行してください。`npm test`にはビルドも含まれます。

```bash
npm run lint
npm test
```

## プロジェクトディレクトリ構成

```text
.
├── app/                              # アプリケーション本体
│   ├── admin/
│   │   └── page.jsx                  # 管理画面 /admin のルート
│   ├── api/
│   │   ├── characters/route.js       # キャラクター一覧のサンプルAPI
│   │   └── rankings/route.js         # ランキング一覧のサンプルAPI
│   ├── components/ui/                # 複数画面で再利用する共通UI
│   │   ├── atoms/                    # Button、Badgeなど最小単位のUI
│   │   ├── molecules/                # 検索欄、能力値表示など複合UI
│   │   └── organisms/                # ダイアログなどまとまった共通UI
│   ├── domain/                       # 表示に依存しないゲームデータとルール
│   │   ├── attract.js                # アトラクト画面の構成と再生時間
│   │   ├── characters.js             # キャラクター定義
│   │   ├── course.js                 # コース区間と障害物定義
│   │   ├── race-session.js           # レースセッションの初期データ
│   │   └── rankings.js               # ランキングデータ
│   ├── features/                     # 機能ごとの画面とロジック
│   │   ├── admin/
│   │   │   ├── components/           # 管理画面専用コンポーネント
│   │   │   ├── hooks/                # Drag & Drop、選択処理のカスタムHook
│   │   │   ├── model/                # レーンへのドロップ判定
│   │   │   └── AdminPage.jsx         # 管理画面の組み立て
│   │   ├── game/
│   │   │   ├── components/           # ゲーム画面専用コンポーネント
│   │   │   ├── race/                 # レース計算、操作、BOT制御
│   │   │   ├── screens/              # 各ゲームフェーズの画面
│   │   │   ├── GamePage.jsx          # ゲーム画面の組み立て
│   │   │   └── GamePhaseRenderer.jsx # 現在のフェーズに対応する画面を表示
│   │   └── race-session/             # 画面間で共有するセッション管理
│   │       ├── race-session-reducer.js # 状態遷移
│   │       ├── race-session-storage.js # localStorageへの保存
│   │       ├── race-session-channel.js # BroadcastChannelでの同期
│   │       └── useRaceSession.js      # 各画面から利用するHook
│   ├── game/
│   │   └── page.jsx                  # ゲーム画面 /game のルート
│   ├── health/
│   │   └── route.js                  # ヘルスチェック用
│   ├── styles/                       # 共通・ゲーム・管理画面のCSS
│   ├── globals.css                   # 全CSSの読み込み口
│   ├── layout.jsx                    # 全ページ共通レイアウトとmetadata
│   └── page.jsx                      # /gameへのリダイレクト
├── doc/                              # 初期計画とバージョン別の実装計画
├── public/
│   ├── characters/                   # キャラクターごとのランナー画像
│   └── og.png                        # og画像
├── scripts/                          # ビルド後処理などの補助スクリプト
├── tests/                            # Node.js標準テスト
├── worker/
│   └── index.js                      # Cloudflare Workersの起動処理
├── eslint.config.mjs                 # ESLint設定
├── next.config.js                    # Next.js互換レイヤーの設定
├── package.json                      # 依存パッケージとnpmコマンド
├── postcss.config.mjs                # Tailwind CSSのPostCSS設定
├── vite.config.js                    # Vinext、Vite、Cloudflare開発設定
└── wrangler.jsonc                    # Cloudflare Workersの公開設定
```

`.next/`、`.vinext/`、`.wrangler/`、`dist/`、`node_modules/`はコマンド実行時に自動生成されるため、人が直接編集する必要はありません。これらはGitでも管理しません。

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

## 開発フロー

### Issue

詳細は `https://app.notion.com/p/logeek/3c44072687e1800c99dbfc43751e8d3d?source=copy_link` を参照してください。

基本的に、Issueを作成してから作業を始めます。
`develop`から、Issue番号を含む作業ブランチを作成してください。

```text
issue/4-admin-drag-drop
issue/12-fix-race-layout
```

### Merge

- 作業ブランチから`develop`へPull Requestを作成する
- セルフレビュー、セルフマージ可
- 不安な場合は、他のメンバーに確認を依頼する
- テストが失敗している状態ではマージしない
- 本番へ反映するときは`develop`から`main`へマージする

## ブランチ運用

| ブランチ | 用途 |
| --- | --- |
| `main` | 本番用 |
| `develop` | 開発/テスト用 |
| `issue/<番号>-<作業内容>` | Issue単位の作業ブランチ。`develop`から作成し、完了後に`develop`へマージする |

原則として`main`と`develop`へ直接コミットせず、Issueに対応する作業ブランチを使用します。

## Cloudflare Workersへの公開

デプロイ前に内容を確認します。

```bash
npm run deploy:dry-run
```

問題がなければCloudflare Workersへ反映します。

```bash
npm run deploy
```

Worker名は`animaldash`です。公開URLは`animaldash.<アカウントサブドメイン>.workers.dev`形式になります。
cloudflare設定が完了するまでは、個人のサブドメインを使用します

- ゲーム画面: [animaldash.kosei-mochizuki.workers.dev/game](https://animaldash.kosei-mochizuki.workers.dev/game)
- 管理画面: [animaldash.kosei-mochizuki.workers.dev/admin](https://animaldash.kosei-mochizuki.workers.dev/admin)
