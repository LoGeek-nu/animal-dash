# ANIMAL DASH! 追加修正実装計画 v0.6

- 文書バージョン: 0.6
- 作成日: 2026-09-03
- 対象: 画像・ステータス生成パイプラインの本番組み込み（[Issue #23](https://github.com/LoGeek-nu/animal-dash/issues/23)起点）
- 主目的: `animal-dash-image-poc`のローカルCLIパイプラインを、会場運用で使える常時稼働APIとして組み込む方針を固める

## 1. 背景

`animal-dash`は現在、`public/characters/`の静的な10体のイラストを使うモック。来場者が紙に描いた動物イラストを撮影し、透過キャラクター画像＋ステータスJSONへ変換するパイプラインは、別リポジトリ [`animal-dash-image-poc`](https://github.com/minmmmmin/animal-dash-image-poc)（Python、ローカル環境で`python -m animal_dash_image_poc.cli run ...`を手動実行するだけのPoC）で検証中（[README.md](../README.md)、[docs/tech-stack.md](../docs/tech-stack.md)に明記）。

これを本番の会場運用で使うには、この生成処理を「常時稼働のAPI」として叩けるようにする必要がある。GitHub Issueはすでに以下の6件に分解済みで、依存関係の起点が**#23「image-pocの判定パイプラインを常時稼働のAPIとしてデプロイする」**。本文書はこの#23のスコープと、後続issueへのつながりを固めるための方針書。

| # | 内容 | 依存 |
| --- | --- | --- |
| [#23](https://github.com/LoGeek-nu/animal-dash/issues/23) | image-pocを常時稼働APIとしてデプロイ（image-poc側） | なし |
| [#25](https://github.com/LoGeek-nu/animal-dash/issues/25) | 生成キャラの画像・データ永続化ストレージ | #20と合わせて設計 |
| [#24](https://github.com/LoGeek-nu/animal-dash/issues/24) | animal-dash側に登録API`POST /api/characters`実装 | #23, #25 |
| [#20](https://github.com/LoGeek-nu/animal-dash/issues/20) | 管理端末⇔ゲーム端末の同期基盤 | なし |
| [#26](https://github.com/LoGeek-nu/animal-dash/issues/26) | 管理画面で撮影画像アップロード→生成リクエスト | #23, #24 |
| [#27](https://github.com/LoGeek-nu/animal-dash/issues/27) | AI生成中の進捗表示・失敗時リトライ導線 | #24 |
| [#28](https://github.com/LoGeek-nu/animal-dash/issues/28) | 新規キャラをゲーム画面（別端末）へリアルタイム反映 | #20 |

## 2. 決定した方針

### 2.1 リポジトリ構成は現状の2個のまま

- `animal-dash`（本体、JS/React、Cloudflare Workers）
- `animal-dash-image-poc`（画像・ステータス生成、Python）

新規リポジトリは作らない。`animal-dash-image-poc`に「常時稼働のAPIサーバー」としての実装を足し、`animal-dash`に「そのAPIを呼ぶ中継エンドポイント」を足す、という2箇所の追加作業になる。

### 2.2 デプロイ先: Vercel（Python / Fluid Compute）

- 理由: `animal-dash-image-poc`は`opencv-python`など、Pythonのネイティブ拡張ライブラリに依存する（image-pocリポジトリの`pyproject.toml`）。Cloudflare WorkersのPython実行環境（Pyodide/WASM）はこの種のライブラリに対応していないため、animal-dash側のWorker上では動かせない。
- VercelはPythonをFluid Compute（通常のLinuxコンテナ相当）で動かせるため、既存の`pipeline.py` / `gemini_status.py` / `preprocessing.py`をほぼそのまま活かして、FastAPIでラップしデプロイできる。
- 運用イメージは今の`npm run deploy`（Wrangler）と同じ感覚のサーバーレスデプロイで、常設サーバーの構築・OS管理は発生しない。
- 新たに必要なもの: Vercelアカウント（組織）、`GEMINI_API_KEY`をVercel環境変数に設定。正式利用前に現行プランを一度確認しておく。

### 2.3 呼び出し経路: animal-dash Workerプロキシ方式

```text
来場者管理画面(ブラウザ)
   │ 画像アップロード
   ▼
animal-dash Worker（既存、新規エンドポイントを1つ追加）
   │ サーバー間通信（認証キー付き）
   ▼
image-poc API（Vercel、新規）
```

- ブラウザは常にanimal-dash自身のAPIにだけ話しかける。image-poc APIを守る認証キーはCloudflare Worker側の環境変数にのみ保管し、ブラウザ・来場者端末には一切渡さない。
- Worker側の中継エンドポイント自体の実装は#24（登録API）のスコープと一体で進める想定。#23は「image-poc APIが認証キー付きでサーバー間から呼べる状態になっていること」までを完了条件とする。

## 3. #23のスコープ（次に着手する部分）

`animal-dash-image-poc`側に、既存CLIパイプラインをHTTP API化して追加する。

- Webフレームワーク: FastAPI
- エンドポイント（暫定）:
  - `POST /v1/characters/generate` — 画像を受け取り、`run_full_pipeline`相当の処理（前処理→Gemini判定）を実行し、透過PNG（base64）とステータスJSONを返す
  - `GET /health` — 常時稼働の死活監視用
- 認証: 共有シークレットをリクエストヘッダーで検証（Worker側の環境変数と一致させる）
- 同時実行数制御: Geminiの無料枠レート制限を踏まえ、同時処理数の上限（image-pocのREADME記載の「4人同時処理を想定」を目安）をセマフォ等で制御し、上限超過時は429を返す
- タイムアウト/リトライ: Gemini呼び出しは1件10〜20秒、混雑時は`503`もあり得る（image-pocのREADME記載）。APIとしてタイムアウトを明示し、リトライ可否をレスポンスに含めて#27（進捗・リトライUI）が判断できるようにする
- 依存ライブラリ: `opencv-python`は`opencv-python-headless`へ切り替え検討（サーバーレス環境でGUI依存を避けるため）
- 既存の`pipeline.py`はファイルパスベースの実装なので、アップロードされたバイト列を扱えるようインターフェースを調整する（ファイル出力前提の関数をメモリ上のbytes入出力に対応させる）

## 4. 後続issueとのつながり（今回は着手しない、方針のみ）

- #25 ストレージ（R2等）・#20 端末間同期基盤: animal-dash側の基盤で、#23とは独立して並行可能
- #24 登録API: #23のimage-poc APIができて初めて実装可能。Workerプロキシの中継エンドポイントもここに含める
- #26 撮影アップロードUI・#27 進捗/リトライUI: #23・#24の後
- #28 ゲーム画面へのリアルタイム反映: #20の後

## 5. 未確定・今後詰める項目

- image-poc API側のレスポンス形式の最終仕様（base64 PNG vs multipart）
- 同時実行数の具体的な上限値（Geminiの現在のレート制限を要確認）
- Vercelアカウント・環境変数の具体的なセットアップ手順
- animal-dash Worker側の中継エンドポイントのパス名・リクエスト形式（#24側で詳細化）

---

[目次に戻る](../README.md#ドキュメント目次)
