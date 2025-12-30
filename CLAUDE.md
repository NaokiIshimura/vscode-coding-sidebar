# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

AIコーディングツール（Claude Code、Cursor、GitHub Copilot等）との連携を強化するVSCode拡張機能。ワークスペース内のファイル・フォルダの効率的な閲覧・管理、Git変更ファイルの追跡など、AIとのコーディング作業を支援する機能を提供する。

## 開発コマンド

```bash
# 依存関係のインストール
npm install

# コンパイル
npm run compile

# ウォッチモード（開発中に使用）
npm run watch

# VSIXパッケージ作成
npm run package

# バージョン更新
npm run version:patch   # 0.0.1 → 0.0.2
npm run version:minor   # 0.0.1 → 0.1.0
npm run version:major   # 0.0.1 → 1.0.0
```

## デバッグ方法

1. `npm run compile` でコンパイル
2. VSCodeで `F5` キーを押してデバッグ開始
3. Extension Development Hostウィンドウが開く
4. コード変更後は `Cmd+R` / `Ctrl+R` でリロード

## アーキテクチャ

### ファイル構成

```
src/
├── extension.ts           # メインファイル（activate関数、全Provider、コマンド登録）
├── types/
│   └── index.ts           # 共通型定義・エラークラス
├── interfaces/            # サービスのインターフェース定義
│   ├── IFileOperationService.ts
│   ├── IClipboardManager.ts
│   ├── IExplorerManager.ts
│   ├── IFileWatcherService.ts
│   ├── IMultiSelectionManager.ts
│   └── ITerminalService.ts
└── services/              # ビジネスロジック
    ├── FileOperationService.ts   # ファイル操作（作成・削除・コピー等）
    ├── ClipboardManager.ts       # クリップボード操作
    ├── ExplorerManager.ts        # エクスプローラー状態管理
    ├── FileWatcherService.ts     # ファイル変更監視
    ├── ConfigurationProvider.ts  # 設定プロバイダー
    ├── SearchService.ts          # 検索機能
    ├── DragDropHandler.ts        # ドラッグ&ドロップ
    ├── ContextMenuManager.ts     # コンテキストメニュー
    ├── KeyboardShortcutHandler.ts# キーボードショートカット
    ├── MultiSelectionManager.ts  # 複数選択管理
    ├── GitignoreParser.ts        # .gitignore解析
    └── TerminalService.ts        # ターミナルセッション管理
```

### 主要コンポーネント（extension.ts内）

extension.tsには以下のProviderクラスが定義されている：

- **MenuProvider**: Menuビューを管理（設定へのアクセス、テンプレート管理等）
- **TasksProvider**: Tasksビュー（フラットリスト表示）を管理、ドラッグ&ドロップ対応
- **EditorProvider**: Markdown EditorのWebViewを管理
- **TerminalProvider**: 埋め込みターミナル（xterm.js）のWebViewを管理

### データフロー

1. TasksProviderでディレクトリ/ファイルを選択（フラットリスト形式）
2. ディレクトリクリックでそのディレクトリ内に移動、".."で親に移動
3. タイムスタンプ形式のMarkdownファイル選択時、EditorProviderにファイルパスが渡される
4. FileWatcherServiceがファイル変更を監視し、各Providerに通知
5. EditorのRunボタンでTerminalProviderにコマンドを送信

### 設定項目（package.json）

- `aiCodingSidebar.defaultRelativePath`: デフォルトの相対パス
- `aiCodingSidebar.markdownList.sortBy`: ソート基準（name/created/modified）
- `aiCodingSidebar.markdownList.sortOrder`: ソート順（ascending/descending）
- `aiCodingSidebar.editor.runCommand`: Runボタン実行コマンド
- `aiCodingSidebar.editor.runCommandWithoutFile`: ファイルなし時のRunコマンド
- `aiCodingSidebar.terminal.*`: ターミナル設定（shell, fontSize, fontFamily, cursorStyle, cursorBlink, scrollback）

## 開発ワークフロー

### 新機能開発時

1. developブランチで開発
2. 機能実装完了後、下記チェックリスト実行
3. VSIXパッケージ作成が成功したらPR作成
4. マージ後はGitHub Actionsが自動実行

### バグ修正時

1. 問題を特定・修正
2. コンパイル確認
3. **必ずVSIXパッケージ作成で動作確認**
4. PR作成

### GitHub Actions修正時

1. ワークフローファイル修正
2. ローカルでVSIXパッケージ作成テスト
3. エラーがないことを確認してからPR作成
4. 特に重要：CHANGELOG生成、特殊文字処理の確認

## プルリクエスト作成前のチェックリスト

### 必須手順（順番を守ること）

#### 1. コンパイル確認

```bash
npm run compile
```

- TypeScriptエラーがないことを確認
- すべてのファイルが正常にコンパイルされることを確認

#### 2. VSIXパッケージ作成

```bash
npm run package
```

- **重要**: PR作成前に必ずVSIXパッケージを作成する
- パッケージサイズとファイル構成を確認
- エラーなく完了することを確認
- `releases/ai-coding-sidebar-*.vsix` が生成されることを確認

#### 3. 変更のコミット・プッシュ

```bash
git add .
git commit -m "descriptive commit message"
git push origin develop
```

#### 4. プルリクエスト作成

```bash
gh pr create --base master --head develop --title "..." --body "..."
```

### VSIX作成が重要な理由

1. **パッケージ整合性**: ローカルでの動作確認
2. **サイズ確認**: .vscodeignoreが正しく動作することを確認
3. **依存関係確認**: --no-dependencies フラグが正常に動作することを確認
4. **事前検証**: GitHub Actionsでエラーが発生する前に問題を検出

## 品質保証

### PR作成前の最終確認

- [ ] `npm run compile` が成功
- [ ] `npm run package` が成功
- [ ] VSIXファイルサイズが適切（~462KB）
- [ ] 新機能の動作確認（Extension Development Host）
- [ ] 既存機能に影響がないことを確認

### マージ後の確認

- [ ] GitHub Actionsが成功
- [ ] GitHub Releasesに新しいリリースが作成
- [ ] VSIXファイルがダウンロード可能
- [ ] リリースノートが正しく生成

### パフォーマンス指標

- パッケージサイズ目標: 500KB未満を維持（現在: ~462KB）
- ローカルビルド: ~30秒以内
- GitHub Actions: ~2分以内

## トラブルシューティング

### VSIXパッケージ作成エラー

- `.vscodeignore` の内容を確認
- `releases/` ディレクトリが循環参照していないか確認
- `--no-dependencies` フラグが正しく動作しているか確認

### GitHub Actionsエラー

- ローカルでのVSIXパッケージ作成が成功することを先に確認
- Node.js バージョンの整合性を確認
- 特殊文字を含むコミットメッセージの処理を確認

## リリースプロセス

mainブランチへのプッシュで自動的に以下が実行される：

1. TypeScriptコンパイル
2. VSIXパッケージ作成
3. GitHub Releaseへアップロード（タグ: v{version}）

## 注意事項

### 基本ルール

- `.claude`ディレクトリはコミット対象外
- Git操作は明示的な指示がない限りコミットしない
- ファイル末尾は必ず空行を含める
- UIラベルは日本語を使用（package.jsonの設定に準拠）
- テストフレームワークは未実装

### やってはいけないこと

- VSIXパッケージ作成をスキップしてPR作成
- コンパイルエラーがある状態でのコミット
- GitHub Actionsの修正を直接masterブランチで実行
- 循環参照を含む.vscodeignoreの設定

### 推奨事項

- 小さな変更でも必ずVSIXパッケージ作成で確認
- descriptive commit messagesを使用
- PR作成時は詳細な説明を記載
- GitHub Actionsログを必ず確認

### 継続的改善

定期的にチェックすること：

- VSCEの最新バージョン確認
- Node.jsバージョンの更新検討
- 依存関係の脆弱性チェック
- パッケージサイズの最適化
