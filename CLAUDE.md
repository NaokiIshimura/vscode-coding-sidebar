# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

AIコーディングツール（Claude Code、Cursor、GitHub Copilot等）との連携を強化するVSCode拡張機能。ワークスペース内のファイル・フォルダの効率的な閲覧・管理、Git変更ファイルの追跡など、AIとのコーディング作業を支援する機能を提供する。

## 開発コマンド

```bash
npm install         # 依存関係のインストール
npm run compile     # コンパイル
npm run watch       # ウォッチモード（開発中）
npm run package     # VSIXパッケージ作成
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
├── extension.ts          # activate関数、コマンド登録（~1,377行）
├── providers/            # UIコンポーネント
│   ├── TasksProvider.ts  # Tasksビュー（フラットリスト、Drag&Drop）
│   ├── EditorProvider.ts # Markdown EditorのWebView
│   ├── TerminalProvider.ts # xterm.jsターミナルのWebView（スクロール位置自動追従、Claude Code自動検知機能付き）
│   ├── MenuProvider.ts   # 設定メニュー
│   └── items/            # TreeItem定義
│       ├── FileItem.ts   # ファイル/ディレクトリ項目
│       └── MenuItem.ts   # メニュー項目
├── utils/                # ユーティリティ
│   ├── fileUtils.ts      # FileInfo, formatFileSize, getFileList, copyDirectory
│   ├── templateUtils.ts  # loadTemplate
│   └── workspaceSetup.ts # setupSettingsJson, setupTemplate, setupClaudeFolder
├── services/             # ビジネスロジック
│   ├── TerminalService.ts    # PTYセッション管理（node-pty、UTF-8ロケール自動設定）
│   ├── FileWatcherService.ts # ファイル変更監視
│   └── ...               # その他サービス
├── interfaces/           # サービスインターフェース定義
└── types/                # 共通型定義
```

### Provider間の依存関係

循環参照を避けるため、インターフェースベースの依存性注入を使用：

- `IEditorProvider`: EditorProviderが実装、TasksProviderが参照
- `ITerminalProvider`: TerminalProviderが実装、EditorProviderが参照

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

## プルリクエスト作成前のチェックリスト

### 必須手順（順番を守ること）

1. **コンパイル確認**: `npm run compile`
2. **VSIXパッケージ作成**: `npm run package`
   - **重要**: PR作成前に必ずVSIXパッケージを作成する
   - `releases/ai-coding-sidebar-*.vsix` が生成されることを確認

## リリースプロセス

mainブランチへのプッシュで自動的に以下が実行される：

1. TypeScriptコンパイル
2. VSIXパッケージ作成
3. GitHub Releaseへアップロード（タグ: v{version}）

## 注意事項

- `.claude`ディレクトリはコミット対象外
- Git操作は明示的な指示がない限りコミットしない
- ブランチを作成する場合は、必ずmainブランチから切ること
- ファイル末尾は必ず空行を含める
- テストフレームワークは未実装
