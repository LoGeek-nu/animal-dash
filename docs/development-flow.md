# 開発フロー

このページは[Notion「開発ルールについて」](https://app.notion.com/p/logeek/3c44072687e1800c99dbfc43751e8d3d?source=copy_link)の内容に沿っています。画像付きの手順（GitHub画面のスクリーンショットなど）はNotion側を参照してください。

基本的には次の流れで開発を進めます。

**Issueを作る → ブランチを作る → 実装・修正する → Pull Requestを作る → developへマージする**

## 1. Issueを作る

基本的に、Issueを作成してから作業を始めます。GitHubリポジトリの「Issues → New issue」から作成します。Issue作成時は`.github/ISSUE_TEMPLATE/issue.md`のテンプレートが選択肢に表示されるので、それを選んで概要と完了条件を記入してください。

Issueを作成すると番号が割り当てられます（例: `#4`）。この番号は次の作業ブランチ名に使用します。

## 2. 作業ブランチを作る

`develop`から、Issue番号を含む作業ブランチを作成してください。ブランチ名は`issue/<Issue番号>-<作業内容>`とし、作業内容は英語で簡潔に書きます。

```text
issue/4-admin-drag-drop
issue/12-fix-race-layout
```

```bash
git checkout develop
git pull
git checkout -b issue/<Issue番号>-<作業内容>
```

## 3. 実装・修正する

作業ブランチ上で実装を進め、変更内容は適宜コミットします。

```bash
git add .
git commit -m "管理画面のドラッグ＆ドロップ機能を追加"
```

作業が完了したらGitHubへPushします。

```bash
git push -u origin issue/<Issue番号>-<作業内容>
```

## 4. Pull Request

- 作業ブランチから`develop`へPull Requestを作成する
- PR作成時は`.github/pull_request_template.md`のテンプレートが適用されるので、対応するIssue番号（`Closes #`）、変更内容、確認項目を記入する
- 他のメンバーにレビューを依頼する
- マージ前に[開発ガイドライン](./development-guide.md)記載のコマンド（`npm run lint` / `npm test`）を実行し、テストが失敗している状態ではマージしない

## ブランチ運用

| ブランチ | 用途 |
| --- | --- |
| `main` | 本番用 |
| `develop` | 開発/テスト用 |
| `issue/<番号>-<作業内容>` | Issue単位の作業ブランチ。`develop`から作成し、完了後に`develop`へマージする |

原則として`main`と`develop`へ直接コミットせず、Issueに対応する作業ブランチを使用します。

本番へ反映するときの手順は[本番リリースフロー](./release-flow.md)を参照してください。
