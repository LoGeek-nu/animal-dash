# 使用技術一覧

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

## 現状の制約

このリポジトリは現在、操作検証用のモックとして実装されています。認証、D1、Durable Objects、R2などのサーバー側データ管理は実装していません。ゲーム状態はブラウザ内（`localStorage`）に保存されるため、別の端末やブラウザとは共有されません。

キャラクターは`public/characters/`の静的な画像を使っており、来場者が描いたイラストを実際に取り込む処理は未実装です。そのイラスト→透過キャラクター画像＋ステータス生成のパイプラインは、[animal-dash-image-poc](https://github.com/minmmmmin/animal-dash-image-poc)という別リポジトリ（Python）でPoCとして検証中です。

`/game`内のフェーズ切り替えはURLルーティングではありません。あらかじめ読み込まれた画面コンポーネントを状態に応じて切り替えるため、フェーズ変更のたびに別ページを読み込むことはありません。詳細は[開発ガイドライン](./development-guide.md)のドメイン用語集を参照してください。

---

[目次に戻る](../README.md#ドキュメント目次)
