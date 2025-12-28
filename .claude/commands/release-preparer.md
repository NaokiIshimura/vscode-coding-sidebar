---
description: リリース準備を実行する（ブランチ作成、README/CHANGELOG更新、コミット、PR作成）
---

リリース準備を開始します。

Task toolを使用して、release-preparerエージェント（subagent_type: release-preparer）を呼び出してリリース準備を実行してください。

エージェントは以下のタスクを自動的に実行します：

1. 現在のバージョンを確認
2. リリースブランチを作成（v{バージョン}）
3. README.md / README-JA.md を更新
4. CHANGELOG.md / CHANGELOG-JA.md を更新
5. 変更をコミット
6. ブランチをプッシュ
7. PRを作成

実行前に `npm run compile` と `npm run package` が成功することを確認してください。

## 注意事項

- コミットメッセージは英語で記述してください
- PRのタイトルは英語で記述してください
- PRのdescriptionは英語で記述してください
