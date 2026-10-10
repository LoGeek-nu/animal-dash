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
- [Tailwind CSS 4](https://tailwindcss.com/) / CSS — Tailwind CSSをCSS処理の基盤として読み込み、画面固有の見た目は主に`app/styles/`以下の通常のCSSで管理しています。
- React Reducer — レースセッションの状態遷移を一か所にまとめるために使用しています。処理は`app/features/race-session/`以下にあります。
- [`localStorage`](https://developer.mozilla.org/ja/docs/Web/API/Window/localStorage) — レーン割り当てやゲームフェーズなど、セッションをブラウザ内にも保存し、リロード時に復元します。
- [`BroadcastChannel`](https://developer.mozilla.org/ja/docs/Web/API/BroadcastChannel) — 同じブラウザで開いたゲーム画面と管理画面の状態を同期します（別端末はDurable Objects経由）。
- [Node.js Test Runner](https://nodejs.org/api/test.html) — ドメインロジック、画面レンダリング、デプロイ設定の自動テストに使用しています。
- [ESLint](https://eslint.org/) — JavaScript / JSXの静的チェックに使用しています。

## 現状の制約

レース結果をD1へ保存し、`GET /api/rankings`で実データを集計できます。画面の固定ランキングは#46で接続予定です。保存・集計仕様と既存R2データの取り込みは[D1とランキングの仕様](./race-storage.md)を参照してください。

同期（`/api/sync`）とキャラクター生成は、スタッフログイン済みの端末だけが使えます。`/login`で合言葉（シークレット`STAFF_PASSCODE`）を入力すると、合言葉から作ったHttpOnly Cookieが発行され、fetchとWebSocketの両方で自動的に送られます。処理は`worker/auth.js`にあります。キャラクター一覧と画像の取得は誰でも可能です。

同期は「`sequence`が大きいセッションを採用する」ルールで行います。Durable Objectは保存中のものより新しいセッションだけを受け付けて他の画面へ配り、古いセッションを送ってきた画面には最新のものを送り返します。

キャラクターは`public/characters/`の静的な10体と、管理画面で撮影した画像から生成したキャラクター（R2に保存）を合わせて使います。生成はanimal-dash Workerが[animal-dash-image-poc](https://github.com/minmmmmin/animal-dash-image-poc)のAPIへ中継して行います。生成キャラクターの一覧は`GET /api/characters`、画像は`GET /api/characters/<id>/image`から取得します。

`/game`内のフェーズ切り替えはURLルーティングではありません。あらかじめ読み込まれた画面コンポーネントを状態に応じて切り替えるため、フェーズ変更のたびに別ページを読み込むことはありません。詳細は[開発ガイドライン](./development-guide.md)のドメイン用語集を参照してください。

---

[目次に戻る](../README.md#ドキュメント目次)
