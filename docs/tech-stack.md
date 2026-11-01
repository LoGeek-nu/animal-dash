# 使用技術一覧

- [JavaScript / JSX](https://developer.mozilla.org/ja/docs/Web/JavaScript) — アプリケーション全体を記述しています。TypeScriptは使用していません。
- [React 19](https://react.dev/) — ゲーム画面と管理画面のUI、状態に応じた画面更新に使用しています。
- [Vinext](https://github.com/cloudflare/vinext) — Next.jsのApp Router形式をViteとCloudflare Workers上で動かすための互換レイヤーです。`app/`以下のルーティングやReact Server Componentsのビルドを担当します。現在はベータ版のため、更新時にはビルドと画面表示の確認が必要です。
- [Vite 8](https://vite.dev/) — ローカル開発サーバーと本番ビルドに使用しています。設定は`vite.config.js`にあります。
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — 公開環境です。Workerの設定は`wrangler.jsonc`、起動処理は`worker/index.js`にあります。
- [Cloudflare R2](https://developers.cloudflare.com/r2/) — AI生成したキャラクターの透過PNGとステータスを保存します（バケット`animaldash-characters`、binding名`CHARACTERS`）。ステータスはオブジェクトの`customMetadata`にJSONで持たせています。処理は`app/api/characters/character-store.js`にあります。
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) / WebSocket — 別端末（スタッフのスマホとプロジェクター接続PCなど）の間でレースセッションをリアルタイムに同期します。全画面が`/api/sync`のWebSocketで1つのDurable Object（`RaceSessionRoom`、binding名`RACE_SESSION`）につながり、最新のセッションの保存と中継を行います。処理は`worker/race-session-room.js`にあります。
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) — Cloudflare Workersのローカル起動、ビルド結果の確認、デプロイに使用するCLIです。
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — キャラクター、レース、出走結果を保存し、クリアタイムランキングを集計します（DB名`animaldash-races`、binding名`DB`）。画像はR2に残します。処理は`worker/data-store.js`、スキーマは`migrations/`です。
- [dnd kit](https://dndkit.com/) — 管理画面でキャラクターをレーンへ割り当てるドラッグ＆ドロップ操作に使用しています。
- CSS — 見た目はすべて`app/styles/`以下の通常のCSSで管理しています。CSSフレームワークは使っていません。ブラウザ差をならすリセットは`app/styles/preflight.css`（Tailwind CSSのpreflightを移したもの）です。
- [M PLUS Rounded 1c](https://fonts.google.com/specimen/M+PLUS+Rounded+1c) — 画面全体の文字に使っています。`@fontsource/m-plus-rounded-1c`のフォントファイルを一緒に配信するため、会場のネットワークがインターネットにつながらなくても表示できます。
- React Reducer — レースセッションの状態遷移を一か所にまとめるために使用しています。処理は`app/features/race-session/`以下にあります。
- [`localStorage`](https://developer.mozilla.org/ja/docs/Web/API/Window/localStorage) — レーン割り当てやゲームフェーズなど、セッションをブラウザ内にも保存し、リロード時に復元します。
- WebSocket — 同じブラウザ内も別端末も、Durable Objectが確定した状態を採用します。localStorageやBroadcastChannelを操作してサーバーの検証を迂回することはできません。
- [Node.js Test Runner](https://nodejs.org/api/test.html) — ドメインロジック、画面レンダリング、デプロイ設定の自動テストに使用しています。
- [ESLint](https://eslint.org/) — JavaScript / JSXの静的チェックに使用しています。

## 現状の制約

レース結果をD1へ保存し、`GET /api/rankings`の実データをレース後TOP 3とアトラクトTOP 10へ表示します。保存・集計仕様と既存R2データの取り込みは[D1とランキングの仕様](./race-storage.md)、表示・取得状態は[ランキング表示の仕様](./ranking-display.md)を参照してください。

`/game` の観戦同期（`/api/sync?role=viewer`）はログイン不要です。合言葉は2つあります。管理操作に使う同期接続とキャラクター生成は管理用（シークレット`STAFF_PASSCODE`）、ゲーム入力に使う同期接続はゲーム用（シークレット`GAME_PASSCODE`）でログインした端末だけが使えます。様子を見るために`/game`を開いた管理スタッフが、ゲーム画面の操作権を取らないように分けています。`/login`で合言葉を入力すると、合った方の合言葉から作ったHttpOnly Cookieが発行され、fetchとWebSocketの両方で自動的に送られます。処理は`worker/auth.js`にあります。キャラクター一覧と画像の取得は誰でも可能です。

状態変更は、権限を確認したうえで保存中の `sequence` の次の1件だけを受け付け、ルームが確定したセッションを全端末へ配ります。レース中はサーバー時刻付きの入力履歴を観戦端末へ配信し、確定結果と共通の処理で走行を再生します。途中参加・再接続時は履歴をまとめて受け取り、現在の進行に追従します。操作端末の選定や閲覧専用の制約は[観戦と操作権限](./spectating.md)を参照してください。

キャラクターは`public/characters/`の静的な10体と、管理画面で撮影した画像から生成したキャラクター（R2に保存）を合わせて使います。生成はanimal-dash Workerが[animal-dash-image-poc](https://github.com/minmmmmin/animal-dash-image-poc)のAPIへ中継して行います。生成キャラクターの一覧は`GET /api/characters`、画像は`GET /api/characters/<id>/image`から取得します。

`/game`内のフェーズ切り替えはURLルーティングではありません。あらかじめ読み込まれた画面コンポーネントを状態に応じて切り替えるため、フェーズ変更のたびに別ページを読み込むことはありません。詳細は[開発ガイドライン](./development-guide.md)のドメイン用語集を参照してください。

---

[目次に戻る](../README.md#ドキュメント目次)
