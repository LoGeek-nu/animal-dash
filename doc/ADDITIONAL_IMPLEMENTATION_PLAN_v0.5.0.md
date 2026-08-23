# ANIMAL DASH! 追加修正用実装計画 v0.5

- 文書バージョン: 0.5.0
- 作成日: 2026-08-19
- 対象: JavaScript / JSX版 ANIMAL DASH! モック
- 基準バージョン: v0.4（commit `a6e1a22`）
- 対象画面: `/admin`、`/game`
- 改修種別: 挙動・デザインを維持した構造リファクタリング

---

## 1. 改修の目的

v0.5では、v0.4までに実装した画面と機能を維持したまま、コードを複数人で安全に変更できる構成へ整理する。

重点項目は次の6点とする。

1. `/game` と `/admin` の画面実装を完全に分離する
2. Atomic Designを基準に、共通UI、画面部品、レイアウトを適切な粒度へ分割する
3. レース計算、入力、BOT、セッション同期を表示コンポーネントから分離する
4. 511行のグローバルCSSを、デザイントークンとコンポーネント単位のスタイルへ分割する
5. ファイル単位の責務を明確にし、同じファイルを複数人が編集する状況を減らす
6. URLルーティングを増やさず、ゲーム内フェーズを遅延なく切り替える

今回の改修では、v0.4の見た目、操作方法、ゲームバランス、最大4レーン、キャラクター10体、認証なしの公開構成を変更しない。

---

## 2. 現状と課題

### 2.1 画面実装の集中

現在の `app/AnimalDashApp.jsx` は約412行あり、次の責務が同居している。

- `/game` の全フェーズ画面
- `/admin` の画面全体
- 管理画面のドラッグ＆ドロップ制御
- レースのフレーム更新
- キーボード、ゲームパッド、BOT入力
- ジャンプ、BOOST、スタミナ、衝突、順位計算
- 確認ダイアログと共通ヘッダー

`app/game/page.jsx` と `app/admin/page.jsx` は別ルートだが、両方が同じ `AnimalDashApp.jsx` を参照している。このため、ゲーム画面だけの変更と管理画面だけの変更でも同じファイルへ差分が集中する。

### 2.2 状態管理の集中

`app/use-race-session.js` は約176行あり、次を1つのHookで扱っている。

- セッション形式の検証
- `localStorage` への保存と復元
- `BroadcastChannel` によるタブ間同期
- カウントダウンとリザルト終了タイマー
- キャラクター登録と削除
- BOT補充
- レース開始、終了、強制終了、リセット
- アトラクト、待機画面への切り替え

保存方式、状態遷移、Reactとの接続が密結合なため、個別のテストや将来の保存方式変更が難しい。

### 2.3 スタイルの集中

`app/globals.css` は約511行あり、次が同じ名前空間に存在している。

- 共通変数とリセット
- アトラクト画面
- 待機画面
- カウントダウン
- レース画面
- リザルト画面
- 管理画面
- ダイアログ
- 全アニメーション
- 全レスポンシブ指定

画面固有のクラスがグローバルに公開されており、セレクタの衝突や意図しない影響が起きやすい。

### 2.4 再利用UIの未統一

ボタン、バッジ、進行バー、キーボード表示などに似た見た目があるが、画面ごとのHTMLとクラス名で実装されている。

- `ghost-button`
- `secondary-button`
- `primary-button`
- `danger-button`
- `secondary-start`
- `race-start-button`
- `assign-button`
- `remove-racer`

状態、サイズ、アクセシビリティを一括して変更できず、デザインのずれが発生しやすい。

---

## 3. 基本設計方針

### 3.1 Atomic DesignとFeature分割の併用

共通UIはAtomic Designで整理し、ゲーム固有・管理画面固有の部品は各Feature内へ配置する。

```text
共通UI
Atoms → Molecules → Organisms
                         ↑
              Game / Admin Features
                         ↑
                 Route Pages
```

Atomic Designの階層だけで全ファイルを管理すると、ゲーム固有部品と管理画面固有部品が混ざりやすい。そのため、次のルールを採用する。

- 2画面以上で再利用するUIは `app/components/ui/` に置く
- 1つのFeatureだけで使う部品は、そのFeature内へ置く
- ScreenはAtomsを直接大量に並べず、MoleculesとOrganismsを中心に構成する
- 単純な `div` や `span` まで機械的にAtom化しない
- 1ファイルにつき、原則として公開コンポーネントは1つにする

### 3.2 依存方向

依存方向を次の一方向に限定する。

```text
app/*/page.jsx
  ↓
features/*/pages・screens
  ↓
features/*/components・hooks
  ↓
components/ui + domain + shared utilities
```

- `game` Featureから `admin` Featureをimportしない
- `admin` Featureから `game` Featureをimportしない
- 両方で必要なデータと同期機能は `race-session` または `domain` へ置く
- AtomsはMolecules、Organisms、Featuresをimportしない
- 循環参照を作らない
- 大きな `index.js` の一括再exportは作らず、利用元から対象ファイルを直接importする

### 3.3 JS / JSXの維持

- 実装はすべて `.js` / `.jsx` とする
- TypeScriptへの移行は行わない
- JSDocは、レース状態や複雑な引数の補助説明に限定して使用する
- 認証、ユーザー管理、権限管理は追加しない

---

## 4. 目標ディレクトリ構成

```text
app/
├─ admin/
│  └─ page.jsx
├─ game/
│  └─ page.jsx
├─ api/
├─ components/
│  └─ ui/
│     ├─ atoms/
│     │  ├─ Button.jsx
│     │  ├─ Button.module.css
│     │  ├─ Badge.jsx
│     │  ├─ Badge.module.css
│     │  ├─ KeyCap.jsx
│     │  ├─ ProgressBar.jsx
│     │  ├─ SectionKicker.jsx
│     │  └─ VisuallyHidden.jsx
│     ├─ molecules/
│     │  ├─ CharacterAvatar.jsx
│     │  ├─ CharacterSummary.jsx
│     │  ├─ ConnectionBadge.jsx
│     │  ├─ SearchField.jsx
│     │  ├─ StatBars.jsx
│     │  └─ StaminaMeter.jsx
│     └─ organisms/
│        └─ ConfirmDialog.jsx
├─ domain/
│  ├─ characters.js
│  ├─ course.js
│  ├─ rankings.js
│  └─ race-session.js
├─ features/
│  ├─ admin/
│  │  ├─ AdminPage.jsx
│  │  ├─ AdminPage.module.css
│  │  ├─ components/
│  │  │  ├─ AdminHeader.jsx
│  │  │  ├─ AdminStatusBar.jsx
│  │  │  ├─ CharacterLibrary.jsx
│  │  │  ├─ CharacterLibraryItem.jsx
│  │  │  ├─ LaneManagement.jsx
│  │  │  ├─ LaneDropTarget.jsx
│  │  │  ├─ BotFillControl.jsx
│  │  │  ├─ AdminControlBar.jsx
│  │  │  └─ CharacterDragOverlay.jsx
│  │  ├─ hooks/
│  │  │  ├─ useCharacterSelection.js
│  │  │  └─ useCharacterDragAndDrop.js
│  │  └─ model/
│  │     └─ lane-collision.js
│  ├─ game/
│  │  ├─ GamePage.jsx
│  │  ├─ GamePhaseRenderer.jsx
│  │  ├─ screens/
│  │  │  ├─ AttractScreen.jsx
│  │  │  ├─ WaitingScreen.jsx
│  │  │  ├─ CountdownScreen.jsx
│  │  │  ├─ RacingScreen.jsx
│  │  │  └─ ResultsScreen.jsx
│  │  ├─ components/
│  │  │  ├─ GameHeader.jsx
│  │  │  ├─ AttractHero.jsx
│  │  │  ├─ AttractTutorial.jsx
│  │  │  ├─ AttractRanking.jsx
│  │  │  ├─ AttractProgram.jsx
│  │  │  ├─ WaitingLaneGrid.jsx
│  │  │  ├─ WaitingCharacterCard.jsx
│  │  │  ├─ CountdownGrid.jsx
│  │  │  ├─ RaceArena.jsx
│  │  │  ├─ RaceLane.jsx
│  │  │  ├─ CourseScenery.jsx
│  │  │  ├─ CourseObstacle.jsx
│  │  │  ├─ Runner.jsx
│  │  │  └─ ResultsBoard.jsx
│  │  └─ race/
│  │     ├─ useRaceEngine.js
│  │     ├─ useRaceControls.js
│  │     ├─ race-engine.js
│  │     ├─ race-ranking.js
│  │     ├─ bot-controller.js
│  │     └─ constants.js
│  └─ race-session/
│     ├─ useRaceSession.js
│     ├─ usePhaseTimers.js
│     ├─ race-session-reducer.js
│     ├─ race-session-actions.js
│     ├─ race-session-validator.js
│     ├─ race-session-storage.js
│     ├─ race-session-channel.js
│     └─ constants.js
├─ styles/
│  ├─ tokens.css
│  ├─ reset.css
│  └─ animations.css
├─ globals.css
├─ layout.jsx
└─ page.jsx
```

最終的に `app/AnimalDashApp.jsx` は削除する。

---

## 5. ルーティングとゲーム内画面切替

### 5.1 URLルーティング

URLは現在の2画面を維持する。

| URL | 役割 |
|---|---|
| `/game` | 来場者向け表示。全ゲームフェーズを表示 |
| `/admin` | スタッフ向け操作画面 |

`/game/attract`、`/game/waiting`、`/game/racing` のようなフェーズ別ルートは追加しない。

### 5.2 ルーティングを増やさない理由

ゲーム内フェーズはURL上のページではなく、同じレースセッションの状態である。フェーズごとにURL遷移すると、次の問題が増える。

- 画面遷移時の追加読込や再初期化
- `requestAnimationFrame` と入力状態の再生成
- セッション復元と管理画面同期の複雑化
- ブラウザバックによる不正なフェーズ移動
- 遷移中の一瞬の空白や表示遅延

### 5.3 `GamePhaseRenderer`

`/game` 内では `session.phase` を受け取る専用コンポーネントだけが表示画面を選ぶ。

```text
GamePage
  ├─ useRaceSession
  └─ GamePhaseRenderer
      ├─ ATTRACT   → AttractScreen
      ├─ WAITING   → WaitingScreen
      ├─ COUNTDOWN → CountdownScreen
      ├─ RACING    → RacingScreen
      ├─ RESULTS   → ResultsScreen
      └─ RECOVERY  → RecoveryScreen または WaitingScreen
```

各Screenは別ファイルへ分割するが、コア画面は静的importする。`React.lazy()` や動的importをフェーズ切替に使用しない。これにより、ファイル分割後もフェーズ移行時にネットワーク読込を発生させない。

`app/game/page.jsx` は `GamePage` を描画するだけのルートエントリとする。

---

## 6. 共通UIのAtomic Design

### 6.1 Atoms

Atomsは、業務知識を持たない最小UIとする。

| Component | 責務 |
|---|---|
| `Button` | 種類、サイズ、disabled、loading、押下状態を統一 |
| `Badge` | ラベル、状態色、丸型表示を統一 |
| `KeyCap` | JUMP、BOOST、キーボードキーの表示 |
| `ProgressBar` | 値、最大値、色、aria属性を統一 |
| `SectionKicker` | 小見出しの文字組み |
| `VisuallyHidden` | 読み上げ専用テキスト |

`Button` は最低限次のvariantを持つ。

- `primary`
- `secondary`
- `ghost`
- `danger`
- `raceStart`
- `icon`

画面側で `primary-button` や `ghost-button` を直接指定しない。

### 6.2 Molecules

MoleculesはAtomsと小さな表示要素を組み合わせる。

| Component | 構成 |
|---|---|
| `CharacterAvatar` | キャラクター画像、配色、compact状態 |
| `CharacterSummary` | Avatar、名前、タイプ、BOT表示 |
| `ConnectionBadge` | 状態ドット、接続ラベル、Badge |
| `SearchField` | label、検索アイコン、input |
| `StatBars` | 複数のStatBar / ProgressBar |
| `StaminaMeter` | BOOSTラベル、ProgressBar |

### 6.3 Organisms

複数画面で使える大きなUIだけを共通Organismとする。画面固有のOrganismは各Feature内へ置く。

`ConfirmDialog` は管理画面以外でも再利用可能なため、共通Organismとして扱う。`GameHeader`、`CharacterLibrary`、`RaceLane` などは用途が限定されるため、各Feature内に置く。

---

## 7. ゲーム画面の分割

### 7.1 Screen単位

各フェーズを独立したScreenへ移す。

- `AttractScreen`
- `WaitingScreen`
- `CountdownScreen`
- `RacingScreen`
- `ResultsScreen`

Screenの責務は、取得済みデータをOrganismsへ渡し、画面全体の配置を決めることに限定する。

### 7.2 アトラクト

現在のアトラクト画面を次へ分離する。

- `AttractScreen`: シーン番号とタイマー
- `AttractHero`: キャラクター紹介
- `AttractTutorial`: 遊び方デモ
- `AttractRanking`: 当日ランキング
- `AttractProgram`: 下部の上映進行
- `AttractFooter`: 次レース案内

シーン時間は引き続き `attract-data.js` 相当の単一データを参照し、画面、進行バー、テストで値を重複させない。

### 7.3 待機・カウントダウン・リザルト

- 待機画面は `WaitingLaneGrid` と `WaitingCharacterCard` へ分離する
- カウントダウンの残り時間計算は専用Hookへ移す
- リザルトのランキング結合と重複除外は純粋関数へ移す
- 各Screen内で直接長い `map()` JSXを書かない

### 7.4 レース画面

`RaceArena` は描画と制御を分離する。

```text
RacingScreen
  └─ RaceArena
      ├─ useRaceEngine
      ├─ RaceLane × 4
      │   ├─ CourseScenery
      │   ├─ CourseObstacle
      │   ├─ Runner
      │   ├─ TrackProgress
      │   └─ StaminaMeter
      └─ RaceFooter
```

`RaceLane` は1レーン分の表示だけを担当し、レース全体の更新処理を持たない。

---

## 8. レースロジックの分離

### 8.1 `useRaceControls`

次の入力だけを担当する。

- キーボードのkeydown / keyup
- ゲームパッド状態の読取
- JUMPとBOOSTのレーン別入力状態
- イベントリスナーの登録と解除

### 8.2 `bot-controller.js`

BOTの判断を純粋関数として分離する。

```text
現在位置 + 次の障害物 + スタミナ + 経過時間
  ↓
{ jump: boolean, boost: boolean }
```

### 8.3 `race-engine.js`

1フレーム分の計算をReactから切り離す。

- 進行距離
- 速度
- BOOST消費と回復
- ジャンプ速度と重力
- 障害物との衝突
- 減速時間
- ゴール時間

DOM、React state、`requestAnimationFrame`、`navigator` を直接参照しない純粋ロジックを目標とする。

### 8.4 `useRaceEngine`

- `requestAnimationFrame` の開始と停止
- 経過時間と `dt` の管理
- `race-engine.js` の呼出
- 描画用stateの更新頻度制御
- 全員ゴール時の `onFinished` 呼出

`RaceArena.jsx` には物理計算を書かない。

### 8.5 順位計算

進行中順位と確定順位を `race-ranking.js` へ移す。

- 表示順ではなくレーン番号との対応を維持する
- 未ゴールは `Infinity` として扱う現在の仕様を維持する
- 同タイム時の安定した並び順を定義する

---

## 9. 管理画面の分割

### 9.1 `AdminPage`

`AdminPage` は次だけを担当する。

- `useRaceSession` の利用
- 管理画面用Hookの利用
- Header、StatusBar、Workspace、ControlBarの配置
- 確認ダイアログの表示状態

キャラクター検索、ドラッグ衝突判定、レーン登録条件を直接記述しない。

### 9.2 キャラクター選択

`useCharacterSelection` へ次を移す。

- 検索文字列
- 名前・タイプによる絞込
- クリック選択
- 使用済みキャラクター判定
- ドラッグ直後のクリック抑止

### 9.3 ドラッグ＆ドロップ

`useCharacterDragAndDrop` へ次を移す。

- DnD Sensor設定
- `activeCharacterId`
- `overLaneId`
- ドラッグ開始、移動、終了、キャンセル
- 読み上げ用アナウンス
- 正常ドロップ時だけ登録する条件

`laneOnlyCollisionDetection` は `model/lane-collision.js` へ移し、Reactへ依存しないテスト可能な関数とする。

### 9.4 管理画面Organisms

- `CharacterLibrary`: 検索欄とキャラクター一覧
- `LaneManagement`: 4レーンとBOT補充
- `AdminStatusBar`: フェーズ、人数、同期時刻、セッションID
- `AdminControlBar`: 上映、待機、強制終了、リセット、開始操作

ボタンは共通 `Button` を利用し、管理画面固有のHTMLを重複させない。

---

## 10. レースセッション管理の分割

### 10.1 Reducer

`race-session-reducer.js` へ状態遷移を集約する。

主なActionは次とする。

- `ASSIGN_CHARACTER`
- `REMOVE_CHARACTER`
- `FILL_BOTS`
- `START_COUNTDOWN`
- `START_RACE`
- `FINISH_RACE`
- `FORCE_FINISH`
- `SHOW_ATTRACT`
- `SHOW_WAITING`
- `RESET_SESSION`
- `RESTORE_SESSION`

無効なフェーズでActionを受けた場合は、現在のstateをそのまま返す。

### 10.2 永続化

`race-session-storage.js` は次だけを担当する。

- `localStorage` からの読込
- JSON変換
- セッション検証
- 保存
- 読込失敗時のフォールバック

### 10.3 タブ間同期

`race-session-channel.js` は `BroadcastChannel` と `storage` イベントを隠蔽する。

- チャンネル名を1か所で管理
- 購読開始時に解除関数を返す
- `sequence` が古いイベントを採用しない
- ブラウザAPIが使えない場合もメモリ上で動作を継続する

### 10.4 フェーズタイマー

カウントダウン終了とリザルト自動終了を `usePhaseTimers` へ移す。`useRaceSession` は、Reducer、永続化、同期、タイマーを接続するFacadeとする。

画面側へ公開するAPIは次の形へ整理する。

```js
const {
  session,
  ready,
  actions,
} = useRaceSession();
```

画面側は保存方法やBroadcastChannelを意識しない。

---

## 11. CSS設計

### 11.1 `globals.css` に残すもの

- `@import "tailwindcss"`
- CSSリセット
- `html`、`body` の基本設定
- フォント
- 全体で使用するCSS変数
- `prefers-reduced-motion` の共通設定

### 11.2 デザイントークン

`styles/tokens.css` へ次を集約する。

- 色
- 文字サイズ
- 角丸
- 影
- 余白
- z-index
- アニメーション時間

既存の `--ink`、`--paper`、`--blue` などを維持し、マジックナンバーを段階的に置き換える。

### 11.3 CSS Modules

画面・コンポーネント固有スタイルは原則として隣接する `.module.css` へ移す。

```text
Button.jsx
Button.module.css

WaitingScreen.jsx
WaitingScreen.module.css
```

- Gameの変更がAdminへ波及しない
- 同じ `.header` や `.card` を安全に使用できる
- 未使用クラスをコンポーネント単位で削除できる
- レスポンシブ指定を対象コンポーネントと同じファイルで管理できる

### 11.4 アニメーション

- 1コンポーネントだけが使うkeyframesは、そのCSS Moduleへ置く
- 複数画面で共通利用するkeyframesだけ `styles/animations.css` へ置く
- アニメーション名とCSS変数にFeature名を含め、用途を判別しやすくする

---

## 12. コンフリクトを減らす実装ルール

- 画面ごとに独立したコミットへ分ける
- 共通UIの変更と画面移行を同じ巨大コミットにしない
- ファイル移動とロジック変更を同時に行わない
- まず同じ内容を新ファイルへ移し、テスト後にロジックを整理する
- `globals.css` は一括書換せず、画面単位でCSS Moduleへ移す
- 共通コンポーネントのprops変更は利用箇所を同じコミットで更新する
- 一時的な互換ラッパーを許可し、全画面の同時移行を避ける
- barrel export用 `index.js` を作らず、競合しやすい中央ファイルを増やさない
- データ定義と表示文言の重複を作らない

---

## 13. 実装手順

### Phase 0: 基準確認

- v0.4のbuild、lint、自動テストを実行
- `/game` と `/admin` の主要状態を基準として記録
- アトラクト、待機、カウントダウン、レース、リザルトのDOMと見た目を確認
- 管理画面のDnD、BOT補充、開始、強制終了、リセットを確認

### Phase 1: 共通UI基盤

- `Button`、`Badge`、`KeyCap`、`ProgressBar` を作成
- `CharacterAvatar`、`StatBars`、`ConnectionBadge` を共通Moleculeへ移動
- `ConfirmDialog` を共通Organismへ移動
- 既存画面を壊さない互換propsを用意

### Phase 2: Game Screen分割

- `GamePage` と `GamePhaseRenderer` を作成
- 5つのScreenを別ファイルへ移動
- `app/game/page.jsx` を薄いルートエントリへ変更
- 静的importでフェーズ切替する
- この段階ではレースロジックを変更しない

### Phase 3: Game Organism分割

- アトラクトをHero、Tutorial、Ranking、Programへ分離
- 待機カード、カウントダウン一覧、リザルト一覧を分離
- `RaceLane`、`Runner`、`CourseScenery` を分離
- Screen内の長いmapと条件分岐を削減

### Phase 4: レースロジック分離

- 入力処理を `useRaceControls` へ移動
- BOT判断を純粋関数化
- 1フレーム計算を `race-engine.js` へ移動
- 順位計算を `race-ranking.js` へ移動
- `useRaceEngine` で描画更新と終了通知を接続

### Phase 5: Admin分割

- `AdminPage` を作成
- Header、StatusBar、CharacterLibrary、LaneManagement、ControlBarを分離
- 選択処理とDnD処理をカスタムHookへ移動
- `app/admin/page.jsx` を薄いルートエントリへ変更

### Phase 6: セッション管理分離

- Session validatorを分離
- ReducerとActionを作成
- storageとchannel adapterを分離
- フェーズタイマーを分離
- 既存の `useRaceSession` 利用箇所を新APIへ移行

### Phase 7: CSS分割

- AtomsからCSS Modulesへ移行
- Adminをコンポーネント単位で移行
- GameをScreen単位で移行
- 共通keyframesとデザイントークンを整理
- 未使用になったグローバルクラスを削除

### Phase 8: 旧ファイル削除

- `AnimalDashApp.jsx` の参照がないことを確認
- 旧 `use-race-session.js`、移行済みデータファイルを削除
- 重複CSSと未使用importを削除
- 旧ファイルを削除するコミットを独立させる

### Phase 9: 総合検証と公開

- build、lint、自動テスト
- `/game` と `/admin` の公開動作確認
- 3解像度で表示確認
- DnD、全ゲームフェーズ、タブ間同期を確認
- コンソールエラー、hydration警告、画像404を確認
- 公開版へ反映

---

## 14. テスト計画

### 14.1 アーキテクチャ回帰

- `app/game/page.jsx` がGame実装を直接持たない
- `app/admin/page.jsx` がAdmin実装を直接持たない
- `AnimalDashApp.jsx` が存在しない
- Game FeatureとAdmin Featureが互いをimportしない
- フェーズ画面が動的importされていない
- 共通Buttonのvariantが各操作へ正しく反映される

### 14.2 セッションReducer

- 全Actionの正常遷移
- 無効フェーズでの操作拒否
- キャラクター重複登録の防止
- BOT補充
- sequence更新
- リセット時のsessionId更新
- 古い同期イベントの拒否

### 14.3 レースエンジン

- 通常走行速度
- BOOST時の速度とスタミナ消費
- スタミナ枯渇と回復
- ジャンプ軌道
- 障害物への衝突と減速
- ジャンプ成功時の障害物回避
- BOTのジャンプ判断
- ゴール時間と順位
- 60秒タイムアウト

### 14.4 Game画面

- 全phaseが対応するScreenを表示する
- フェーズ切替でURLが `/game` のままである
- フェーズ切替時に追加ページ遷移が発生しない
- アトラクトの9秒 / 21秒 / 11秒を維持する
- 待機、レース、リザルトの見た目と文言がv0.4から変わらない

### 14.5 Admin画面

- 左側でのドラッグはレーン登録されない
- レーン上で離した場合だけ登録される
- クリック代替操作が動作する
- BOT補充、開始、強制終了、リセットが動作する
- 各ボタンのdisabled状態と確認ダイアログが維持される

### 14.6 総合確認

- `/game`、`/admin`、`/health` がHTTP 200
- 認証画面へ転送されない
- `BroadcastChannel` と `localStorage` の同期が動く
- 1920×1080、1366×768、1024×768で表示崩れがない
- ブラウザコンソールにerror、hydration警告がない

---

## 15. 完了条件

- [ ] `/game` と `/admin` が同じ画面実装ファイルを参照していない
- [ ] `app/game/page.jsx` と `app/admin/page.jsx` が薄いルートエントリになっている
- [ ] `AnimalDashApp.jsx` が削除されている
- [ ] 全ゲームフェーズが別Screenコンポーネントになっている
- [ ] 共通ボタンが `Button` のvariantで統一されている
- [ ] 再利用UIがAtoms、Molecules、Organismsへ整理されている
- [ ] ゲーム固有部品と管理画面固有部品がFeature単位で分離されている
- [ ] レースの物理計算、入力、BOT、順位計算がReact表示から分離されている
- [ ] セッションReducer、保存、同期、タイマーが別モジュールになっている
- [ ] `globals.css` が共通設定中心になっている
- [ ] 画面固有CSSがCSS Modulesへ移行されている
- [ ] `/game` と `/admin` のURL構成が維持されている
- [ ] ゲーム内フェーズ切替でURL遷移や追加読込が発生しない
- [ ] v0.4のデザイン、操作、ゲームバランスが維持されている
- [ ] 認証が追加されていない
- [ ] build、lint、自動テスト、実ブラウザ確認が成功する
- [ ] 公開版 `/game` と `/admin` で回帰がない

---

## 16. 主な移行元と移行先

| 現在 | v0.5での移行先 |
|---|---|
| `app/AnimalDashApp.jsx` の `GameExperience` | `app/features/game/GamePage.jsx` |
| `AttractScreen` | `app/features/game/screens/AttractScreen.jsx` |
| `WaitingScreen` | `app/features/game/screens/WaitingScreen.jsx` |
| `CountdownScreen` | `app/features/game/screens/CountdownScreen.jsx` |
| `RaceArena` | `app/features/game/components/RaceArena.jsx` + `race/*` |
| `ResultsScreen` | `app/features/game/screens/ResultsScreen.jsx` |
| `AdminExperience` | `app/features/admin/AdminPage.jsx` |
| `laneOnlyCollisionDetection` | `app/features/admin/model/lane-collision.js` |
| AdminのDnD stateとhandler | `app/features/admin/hooks/useCharacterDragAndDrop.js` |
| `ConfirmDialog` | `app/components/ui/organisms/ConfirmDialog.jsx` |
| `ConnectionBadge` | `app/components/ui/molecules/ConnectionBadge.jsx` |
| `app/use-race-session.js` | `app/features/race-session/*` |
| `app/race-data.js` | `app/domain/characters.js`、`rankings.js`、`race-session.js` |
| `app/course-data.js` | `app/domain/course.js` |
| `app/globals.css` | `app/styles/*` + 各 `.module.css` |

---

## 17. v0.5で変更しないもの

- キャラクター画像とキャラクター数
- ゲーム画面と管理画面の見た目
- アトラクトの内容と表示時間
- レース速度、ジャンプ、BOOST、スタミナ、障害物判定
- 最大4レーン
- BOTの体験上の強さ
- `localStorage` と `BroadcastChannel` を使うモック同期方式
- `/game` と `/admin` のURL
- 認証なしの公開構成

将来、認証、永続DB、オンライン通信を追加する場合も、v0.5で分離するStorage、Channel、Session Actionを差し替え可能な境界として利用する。
