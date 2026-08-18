# ANIMAL DASH! モック

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

- 登録済み10キャラクターの検索・選択・解除
- 最大4レーンへの割り当てとBOT補充
- `BroadcastChannel` と `localStorage` を使ったタブ間リアルタイム同期
- 3秒カウントダウン、4レーンの自動スクロールレース
- キーボード／Gamepad APIによるジャンプと加速
- スタミナ消費・回復、障害物、衝突、順位・タイム
- リザルト、日別TOP3、90秒後の自動リセット
- スタッフによる強制終了・スキップ・リセット
- サンプルAPI `/api/characters` と `/api/rankings`

キーボードはレーン順に、レーン1が `Space / Shift`、レーン2が `↑ / Enter`、レーン3が `W / E`、レーン4が `I / O` です。各組の左がジャンプ、右が加速です。

## 実装範囲

本成果物はフロントエンド体験の検証を目的としたモックです。Durable Objects、D1、R2、Cloudflare Accessはまだ接続せず、ブラウザ内の共有状態で代替しています。本実装へ移行する際は `use-race-session.ts` の状態更新をWebSocketメッセージへ、静的キャラクターデータをD1/R2へ置き換えられる構成です。

## 検証

```bash
npm run build
npm test
```
