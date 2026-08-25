# 開発ガイドライン

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

## Lintについて

`npm run lint`は[ESLint](https://eslint.org/)を実行し、JavaScript / JSXのコードを静的にチェックします。設定は`eslint.config.mjs`にあり、次のルールセットを組み合わせています。

| ルールセット | チェック内容 |
| --- | --- |
| `eslint.configs.recommended` | 未使用変数・到達不能コードなど、ESLint標準の基本的な誤りを検出 |
| `react.configs.flat.recommended` / `jsx-runtime` | Reactのベストプラクティス。React 19の新しいJSX変換に合わせているため、`import React`は不要 |
| `reactHooks.configs.flat["recommended-latest"]` | `useEffect`の依存配列漏れなど、Hooksの誤用を検出 |
| `jsxA11y.flatConfigs.recommended` | 画像の`alt`属性不足など、JSXのアクセシビリティ上の問題を検出 |
| `next.configs["core-web-vitals"]` | Next.js（Vinext互換レイヤー）のパフォーマンス関連ルール |

コミット・PR前には必ず`npm run lint`を実行し、指摘を解消してください。指摘の多くは`npm run lint -- --fix`で自動修正できます。

## ゲームドメイン用語集

初めてコードを読む場合、まず`app/domain/`配下のファイルを見るとゲーム全体のルールが把握できます。表示（React）とルール（ドメイン）を分けているため、画面の見た目を変えたいだけならルール側のファイルを触る必要はありません。

| 用語 | 説明 | 主なファイル |
| --- | --- | --- |
| フェーズ（phase） | ゲームの状態（`ATTRACT` → `WAITING` → `COUNTDOWN` → `RACING` → `RESULTS`）。管理画面・ゲーム画面はどちらもこのフェーズを見て表示を切り替えます。 | `app/features/race-session/race-session-reducer.js` |
| セッション（session） | レーン割り当て、フェーズ、レース結果などレース1回分の状態全体。`localStorage`に保存し、`BroadcastChannel`で他画面へ同期します。 | `app/domain/race-session.js`, `app/features/race-session/` |
| アトラクト画面 | 誰もプレイしていない待ち受け中に流れる紹介・チュートリアル・ランキング演出。 | `app/domain/attract.js` |
| コース／障害物 | レースコースの区間（`courseSegments`）と、区間内に配置された障害物（`courseObstacles`）。ジャンプで避けられなかった場合はペナルティ（`penaltyMs`など）が発生します。 | `app/domain/course.js` |
| キャラクター | プレイヤーが選べる動物と、その能力値（`speed`/`acceleration`/`stamina`）。 | `app/domain/characters.js` |
| ランキング | 過去の記録（`staticRanking`）と当日の結果を合成して上位を出す処理。 | `app/domain/rankings.js` |
| レーン | 最大4体の動物が同時に走る枠。管理画面からキャラクターをドラッグ＆ドロップで割り当てます。 | `app/features/admin/` |
| BOT | 人が操作しない自動制御のキャラクター。管理画面の「BOTで埋める」操作で空きレーンに割り当てられます。 | `app/features/game/race/` |

## キーボード操作（モック用）

現在はモックのため、キーボードで動かすことが可能です。各レーンの左側がジャンプ、右側が加速です。

| レーン | ジャンプ | 加速 |
| --- | --- | --- |
| 1 | `Space` | `Shift` |
| 2 | `↑` | `Enter` |
| 3 | `W` | `E` |
| 4 | `I` | `O` |

## テスト構成

`npm test`は`tests/`配下の全テストを実行します。それぞれの役割は次のとおりです。

| ファイル | 内容 |
| --- | --- |
| `tests/domain.test.mjs` | `app/domain/`のレースルール・ランキング計算など、表示に依存しないロジックを検証します。 |
| `tests/rendered-html.test.mjs` | ビルド後の画面が期待通りHTMLとして描画されるかを検証します。 |
| `tests/deployment.test.mjs` | `wrangler.jsonc`など、デプロイ設定に不整合がないかを検証します。 |

## Issue / Pull Request テンプレート

`.github/ISSUE_TEMPLATE.md`と`.github/pull_request_template.md`が用意されています。Issue作成・PR作成時は自動的にこのテンプレートが適用されるため、概要・完了条件（Issue）や変更内容・確認チェックリスト（PR）を埋めてください。開発フローの詳細は[開発フロー](./development-flow.md)を参照してください。
