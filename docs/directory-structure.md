# ディレクトリ構成

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
├── doc/                               # 初期計画とバージョン別の実装計画
├── docs/                              # 開発者向けドキュメント（本ディレクトリ）
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

## `doc/`と`docs/`の違い

- `doc/` — バージョンごとの実装計画（設計記録）専用です。一覧は[`doc/README.md`](../doc/README.md)にあります。通常の機能変更に合わせて都度更新する必要はありません。
- `docs/` — このファイルを含む、開発に参加するために読む開発者向けドキュメントです。
