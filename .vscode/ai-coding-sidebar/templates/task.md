作成日時: {{datetime}}

---

# バージョン
本ファイルが配置されてるディレクトリ名を{バージョン}として扱って

# 基本ルール
- `{バージョン}`のブランチを作成して
- バージョンを`{バージョン}`にあげて

# 実装完了後
コードの修正が完了したらコンパイルして

# リリース準備
指示をしたら以下を実行して
- READMEを更新して
- README-JAを更新して
- CHANGELOGを更新して
- CHANGELOG-JAを更新して
- git commit
- pr 作成
  - pr title の先頭には「[{バージョン}] 」をつけて

# 言語
- UI上の表記は英語にして
- commit メッセージは英語にして
- pr title, descriptionは英語にして

# 用語
  | 変数名         | 用途                                       |
  |----------------|--------------------------------------------|
  | tasksViewPanel | Tasks Viewでディレクトリ選択時に開くパネル |
  | commandPanels  | "Open Task Panel" コマンドで開くパネル     |

---

# task

## views

### menu

### tasks

### editor

### terminal

### active panels

## task panel

### docs section

### editor section

