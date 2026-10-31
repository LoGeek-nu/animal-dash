# 画像APIのCDNキャッシュ（Issue #88）

生成キャラクター画像の `/api/characters/<id>/image` はWorkersの入口で処理し、Cloudflare Cache APIでR2から取得した画像を保存します。キャッシュHITではR2へアクセスしません。キャッシュはCloudflare拠点ごとで、全拠点へ自動複製されるものではありません。

- 保存対象は公開画像のGET・200応答だけです。404・503やHEADの空ボディは保存しません。
- キーはホストとキャラクター画像のパスです。Cookie・任意のクエリ文字列はキーに含めません。
- Content-Type・Content-Length・ETag・Last-Modifiedを保持し、If-None-Matchに対応します。画像は今までどおりストリームで返します。
- Cache-Controlは `public, max-age=31536000, immutable`。画素を書き換える場合は新しいID／URLを発行してください。
- キャッシュ読み取り・書き込みが失敗しても、取得可能なR2画像を返します。
- 新たに画像APIを共有キャッシュへ公開する変更ではありません。画像は従来からログイン不要で取得でき、ユーザー別の応答を含みません。

## 検証環境へのデプロイ

`wrangler.jsonc` の `env.develop` にWorker `animaldash-develop` と専用のD1・R2・独自ドメインを設定しています。本番の接続先はトップレベルの設定のままです。

```bash
npm run deploy:develop
```

このコマンドは `CLOUDFLARE_ENV=develop` を指定してビルドしてから、そのビルドが出力した `dist/server/wrangler.json` でデプロイします。ビルド済みの本番成果物を名前だけ変えてデプロイしないでください。WranglerがカスタムドメインのDNS・証明書を設定します。

- 管理画面: https://animaldash-develop.logeek.tech/admin
- ゲーム画面: https://animaldash-develop.logeek.tech/game
- 従来の `animaldash-develop.nu-chs-logeek.workers.dev` も残しますが、Cache APIの有効性は独自ドメインで検証します。workers.devへの画像要求は明示的にBYPASSします。
- ドメインが変わるため、初回は新ドメインでもスタッフログインしてください。合言葉は既存の検証環境と共通です。

## 応答ヘッダーでの確認

| ヘッダー | 意味 |
| --- | --- |
| `X-Image-Cache: MISS` | キャッシュになく、R2から取得して保存 |
| `X-Image-Cache: HIT` | Cloudflareキャッシュから取得 |
| `X-Image-Cache: BYPASS` | 検証用の迂回、workers.dev、またはCache API未提供 |
| `X-Image-R2-Reads: 0 / 1` | その画像要求でR2を読み取った回数 |
| `Server-Timing` | `image_cache`はキャッシュ検索、`r2`はR2取得開始からヘッダー取得まで、`image`は画像ハンドラーの処理時間（ms） |

`Server-Timing` はボディ全体の転送時間を含みません。HIT時は `r2` の計測項目がなく、R2読み取り回数が0になります。`CF-Cache-Status` はこのアプリのCache APIのHIT/MISSを示すものとして扱わず、上記のヘッダーで確認してください。

検証環境の `IMAGE_CACHE_BENCHMARK=true` の場合だけ、要求ヘッダー `X-Image-Cache-Bypass: 1` でキャッシュの読み書きを迂回し、同じURLから直接R2へ取得します。本番にはこの変数を設定しません。

## 再現可能な速度比較

```bash
node scripts/benchmark-image-cache.mjs https://animaldash-develop.logeek.tech 10 outputs/image-cache-benchmark.json
```

「写真テスト」の最新12枚について、キャッシュHITとBYPASSの本文SHA-256・ETagを照合してから、各10組（計240件）をcurl HTTP/2の接続プールを再利用して取得します。ブラウザやローカルHTTPキャッシュは使いません。順序はHIT→BYPASSとBYPASS→HITを交互にし、DNS/TLS接続が新規作成された組やCloudflare拠点が異なる組は集計から除外します。

TTFB（要求開始から先頭バイト）と画像全体の取得時間について、中央値・p95・改善率を生データと共にJSONへ保存します。負の改善率もそのまま報告します。

HTTPキャッシュの追加では画像のバイト数は減りません。初回MISS、別のCloudflare拠点、端末の回線・画像デコードによって効果は変わります。先行するChromeのStalled事象の根本原因・解消は、この計測では証明しません。

## 検証環境での実測結果

2026年11月1日 08:09〜08:11 JST、独自ドメインのCloudflare NRT拠点で計測。写真相当JPEGの最新12枚を各10回、CDN HITとBYPASSで各120件（計240件）取得し、除外は0組でした。同一端末・同一URL・HTTP/2接続再利用、AB/BA交互順序で画像全体を取得。ブラウザキャッシュは使わず、BYPASSヘッダー以外は同じ経路・実装です。事前に12枚すべてのHIT/BYPASS本文SHA-256とETagを照合しました。

| 指標 | CDN未使用（R2直接） | CDN HIT | 短縮率 |
| --- | ---: | ---: | ---: |
| TTFB 中央値 | 121.25 ms | 49.40 ms | 59.3% |
| TTFB p95 | 168.47 ms | 98.21 ms | — |
| 画像全体の取得 中央値 | 410.29 ms | 352.14 ms | 14.2% |
| 画像全体の取得 p95 | 801.00 ms | 711.32 ms | — |
| ハンドラー処理 中央値 | 71 ms | 4 ms | — |
| 1要求あたりのR2読み取り | 1回 | 0回 | — |

画像全体の取得中央値は約58ms短縮しました。ウォームキャッシュでの単一端末の実測であり、初回MISS・別拠点・スマホ回線で同じ短縮率を保証しません。容量は減らないため、画像全体の転送改善はTTFBより小さくなっています。以前のChromeのStalled事象の解消を示す計測ではありません。

- 実装コミット: `25a5cec`
- develop Worker version: `d3a05d73-dc04-45b9-b9ef-aa90421a8efe`
- [集計値・全240要求・ウォームアップの生データ](./benchmarks/issue88-image-cache-20261101.json)（単位: 生データのttfb/totalは秒、集計値はms）
- 全計測要求がHTTP 200。HITは全120件でR2読み取り0回、BYPASSは全120件で1回。

## 参考

- [R2とCache API](https://developers.cloudflare.com/r2/examples/cache-api/)
- [Cache APIの拠点・ヘッダー・メソッドの仕様](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Workersのカスタムドメイン](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Viteプラグインの環境選択](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)
