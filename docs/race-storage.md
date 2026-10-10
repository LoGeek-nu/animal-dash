# D1とランキングの仕様

Issue #44の保存・集計基盤です。[#45の計測・確定結果の仕様](./race-timing.md)に接続します。画面の固定ランキングをAPIに接続する作業は#46で行います。

## データ構造

| 保存先 | 内容 |
|---|---|
| D1 `characters` | 元のID、名前、ステータス、表示データ、生成フラグ、R2の画像キー |
| R2 `animaldash-characters` | `characters/<id>.png`。従来のメタデータも取り込み・復旧用に維持 |
| D1 `races` | レースID、開始・完了日時（Unixミリ秒）、コースシード、確定結果 |
| D1 `race_results` | レース・キャラクターの外部キー、レーン（1～4）、順位、`finishMs`、BOTフラグ、保存時のキャラクタースナップショット |

静的10体もマイグレーションでD1に登録します。IDは`momo`など既存の値を維持し、画像キーは`null`、画像は従来どおり`public/characters/`を使います。生成キャラクターはR2保存後にD1へ登録し、`GET /api/characters`はD1から一覧を取得します。

## ローカル開発と公開

```bash
npm install
npm run db:migrate:local
npm run dev
```

ローカルD1とR2は`.wrangler/state`以下に保存され、本番とは別です。マイグレーションは適用済みファイルを重複適用しません。テスト用Miniflareは独立した一時DB・R2を使います。本番DBの作成、UUID登録、本番マイグレーションは[デプロイ手順](./deployment.md#d1の作成とマイグレーション)を参照してください。

DB未設定・未初期化・利用不能時、一覧・ランキングAPIは503を返します。空のランキングや架空の記録で成功扱いにはしません。

## 既存R2キャラクターの取り込み

対象環境で`/login`からスタッフログインし、そのサイトのブラウザ開発者コンソールで実行します。ローカルはマイグレーション後、本番はマイグレーションとデプロイ後に実行してください。

```js
let cursor;
do {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`/api/characters/import${query}`, { method: "POST" });
  if (!response.ok) throw new Error(`取り込み失敗: ${response.status}`);
  const page = await response.json();
  console.log(page); // imported / skipped（不正メタデータの画像キー）/ cursor / done
  cursor = page.cursor;
} while (cursor);
```

1回につき最大100オブジェクトを処理します。ID、画像キー、アップロード日時を維持し、画像は変更しません。不正JSON・IDと画像キーの不一致・不正ステータスは`skipped`で報告します。同じIDへのupsertなので再実行しても重複しません。D1書き込みに失敗したページは同じcursorで再試行できます。生成後にD1だけ失敗した場合も、この方法でR2から復旧できます。

## 結果保存と#45との接続

同期サーバーが新しい`RESULTS`セッションを採用すると、`worker/race-record.js`で以下の形式に変換します。

```js
{
  raceId: "race-unique-id",
  startedAt: 1791601200000,
  completedAt: 1791601260000,
  courseSeed: "oureisai-2026-demo",
  results: [
    { characterId: "momo", lane: 1, rank: 1, finishMs: 30000, isBot: false },
    { characterId: "toramaru", lane: 2, rank: 2, finishMs: null, isBot: true }
  ]
}
```

`finishMs`は0以上60,000未満の整数ミリ秒、未完走は`null`です。結果のレーン・キャラクター・BOTフラグは出走レーンと照合します。各レースの一意の`raceId`と、固定した`raceCompletedAt`を保存に使います。旧形式では`sessionId:raceStartedAt`と`lastSync`にフォールバックします。開始前の強制終了は保存せず、開始後の強制終了は全員DNFとして保存します。

結果は先にDurable Objectの永続outboxへ、表示セッションと同じトランザクションで保存します。続いてD1の`batch`でキャラクター・レース・全出走結果を一括保存します。D1障害時も同期は継続し、outboxは次のレースに移行しても残ります。alarmで30秒後に再試行し、成功まで保持します。

保存成功時、WebSocketで`{ type: "results-saved", raceId }`を全端末へ通知します。#46ではこの通知後に再取得するなど、D1保存完了を待ってランキングを表示してください。

同じレースIDの同一結果は重複登録しません。先に確定した結果は不変で、異なる内容を同じIDで保存するとエラーになります。結果保存時の名前・ステータスをスナップショットに保持します。ステータス編集機能を追加する場合は、出走中の変更を禁止するか、開始時点のスナップショットを渡す設計が必要です。

保存前の過去レースは復元できません。複数ゲーム端末から同時に結果が届いた場合は、同期サーバーが先に採用した結果を保存します。

## 今日のランキング

- 開催日: `Asia/Tokyo`（JST）の00:00以上、翌日00:00未満に**開始した**レース。日をまたいでも開始日に含めます。
- 指標: `finishMs`が短い順。キャラクターごとにその日の最短記録を1件採用します。
- 同一ベストタイムが複数ある場合は開始日時、レースID、レーンの順に選びます。
- BOTとDNFはランキングから除外し、出走履歴には保存します。
- 同タイムは同順位（1位・1位・3位）。表示順はキャラクターID順です。
- `limit`は表示件数。同順位があっても最大3件／10件で打ち切ります。
- キャラクター情報は最短記録のスナップショットから返します。

レース後TOP 3とアトラクトTOP 10で同じAPIを使います。

```text
GET /api/rankings?limit=3
GET /api/rankings?limit=10&date=2026-10-10
```

`date`は省略すると現在の日本時間の日付、`limit`は1～10の整数（省略時10）です。不正な日付・件数は400、記録がなければ200で`rankings: []`を返します。`Cache-Control: no-store`です。

```json
{
  "date": "2026-10-10",
  "timezone": "Asia/Tokyo",
  "metric": "finishMs",
  "unit": "milliseconds",
  "tiePolicy": "competition",
  "botsIncluded": false,
  "mock": false,
  "rankings": [
    {
      "rank": 1,
      "characterId": "momo",
      "displayName": "ももラビ",
      "character": { "id": "momo", "name": "ももラビ", "stats": { "speed": 9, "acceleration": 8, "stamina": 6 } },
      "finishMs": 30000,
      "raceId": "race-unique-id"
    }
  ]
}
```

例の`character`は省略表記です。実際は従来の色・絵文字・キャプションも返し、生成キャラクターには`imageUrl`を含めます。

## 参考

- [D1 batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [D1マイグレーション](https://developers.cloudflare.com/d1/reference/migrations/)
- [Durable Object alarmsと再試行](https://developers.cloudflare.com/durable-objects/api/alarms/)
