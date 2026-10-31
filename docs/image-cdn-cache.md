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

## 参考

- [R2とCache API](https://developers.cloudflare.com/r2/examples/cache-api/)
- [Cache APIの拠点・ヘッダー・メソッドの仕様](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Workersのカスタムドメイン](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Viteプラグインの環境選択](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)
