# ANIMAL DASH! 実装計画書一覧

ANIMAL DASH!の初期計画と追加修正計画は、すべてこのディレクトリで管理する。

| 呼称 | 文書内バージョン | ファイル | 主な内容 |
| --- | --- | --- | --- |
| v1 | 0.1 | [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) | 初期モック、画面、レース、Cloudflare構成の実装計画 |
| v2 | 0.2 | [`ADDITIONAL_IMPLEMENTATION_PLAN_v0.2.md`](./ADDITIONAL_IMPLEMENTATION_PLAN_v0.2.md) | アトラクト画面、手描きテイスト、全身ランナー |
| v3 | 0.3 | [`ADDITIONAL_IMPLEMENTATION_PLAN_v0.3.md`](./ADDITIONAL_IMPLEMENTATION_PLAN_v0.3.md) | JavaScript／JSX化、認証撤去、管理画面とコース改善 |
| v4 | 0.4 | [`ADDITIONAL_IMPLEMENTATION_PLAN_v0.4.md`](./ADDITIONAL_IMPLEMENTATION_PLAN_v0.4.md) | ドラッグ＆ドロップ、アトラクト、ゲーム画面、待機画面改善 |
| v5 | 0.5.0 | [`ADDITIONAL_IMPLEMENTATION_PLAN_v0.5.0.md`](./ADDITIONAL_IMPLEMENTATION_PLAN_v0.5.0.md) | Atomic Designを重視したコンポーネント分割 |
| v5.5 | 0.5.5 | [`ADDITIONAL_IMPLEMENTATION_PLAN_v0.5.5.md`](./ADDITIONAL_IMPLEMENTATION_PLAN_v0.5.5.md) | ChatGPT Sites撤去とCloudflare Workers移行 |

## 命名について

会話上の「v1〜v5」と、既存文書内の「0.1〜0.5.0」は同じ順序を指す。初期計画は`IMPLEMENTATION_PLAN.md`をv1として扱い、本文は元資料をそのまま保持している。追加修正計画は各文書内のバージョンを併記する。

今後の実装計画も、プロジェクトルートではなくこの`doc/`へ追加する。
