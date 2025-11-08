# Change Log

このプロジェクトのすべての重要な変更は、このファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [セマンティックバージョニング](https://semver.org/lang/ja/) に準拠しています。

## [0.3.6] - 2025-11-08

### 修正
- **Markdown Listの更新機能**: Markdown Listビューの更新ボタンがファイルリストを更新しない問題を修正
  - 更新コマンドがDirectory ListとMarkdown Listの両方のビューを正しく更新するように変更
  - Markdown Listビューで更新ボタンをクリックしても効果がなかった問題を解決
- **ファイルシステム変更の自動反映**: 初期ロード時にファイル監視が有効化されない問題を修正
  - ファイル監視リスナーをセットアップ時ではなく、プロバイダーのコンストラクタで登録するように変更
  - エクスプローラーやターミナルなどでファイル・ディレクトリを追加・削除した際に、ビューが自動的に更新されるようになりました
  - Directory ListとMarkdown Listの両方のビューが、拡張機能外部でのファイル変更を自動的に反映します
- **拡張機能コマンド実行後のビュー更新**: ファイル操作後のビュー更新動作を改善
  - Markdownファイル作成コマンドで、Directory ListとMarkdown Listの両方のビューを更新するように変更
  - 名前変更コマンドで、ディレクトリ構造の変更を反映するために両方のビューを更新するように変更

### 変更
- **デフォルト相対パス**: デフォルト値を空文字列から".ai/tasks"に変更
  - 新規インストール時に自動的に".ai/tasks"ディレクトリが開かれるようになりました
  - AIコーディングワークフローに適した初期設定を提供

## [0.3.0] - 2025-01-12

### 削除
- **ワークスペースエクスプローラービュー**: 冗長なワークスペースエクスプローラービューを削除し、拡張機能をシンプル化
  - `workspaceExplorer`ビュー定義を削除
  - このビューでのみ使用されていたcopy/cut/paste/searchInWorkspaceコマンドを削除
  - ワークスペースエクスプローラーに関連するすべてのメニュー項目とキーバインディングを削除
  - WorkspaceExplorerProviderクラスを削除（374行）
  - **コード削減**: 687行を削除
  - コア機能（Directory List、Markdown List、File Changes）は変更なし

## [0.2.6] - 2025-01-11

### 変更
- **エラーメッセージの英語化**: 残っていた日本語のエラーメッセージを英語に変更
  - ContextManagerの操作失敗メッセージ
  - DragDropHandlerのファイル操作エラーメッセージ
  - KeyboardShortcutHandlerの操作失敗メッセージ

## [0.2.5] - 2025-01-11

### 変更
- **UIの英語化**: すべてのユーザー向けメッセージを日本語から英語に変更
  - 情報メッセージ、エラーメッセージ、警告メッセージ
  - 入力プロンプト、クイックピック、確認ダイアログ
  - ツールチップ、ステータスバー、設定項目のラベルと説明
  - ビューのタイトル表示（Directory List, Markdown List, Explorer）

## [0.1.0] - 2025-01-11

### 追加
- **ワークスペースエクスプローラー**: プロジェクト全体をツリー形式で表示する新しいビュー
- **ファイルアイコン表示**: ファイル種別に応じた50種類以上のアイコンを自動表示
  - TypeScript、JavaScript、JSON、Markdown、CSS、HTML、画像ファイルなど主要な形式をサポート
  - `fileListExtension.showFileIcons`設定でアイコンの表示/非表示を切り替え可能
- **ソート機能**: 名前、種類、サイズ、更新日時でソート可能
  - `fileListExtension.sortBy`設定でソート基準を選択
  - `fileListExtension.sortOrder`設定で昇順/降順を選択
- **隠しファイル表示**: 隠しファイル・フォルダの表示/非表示を切り替え
  - `fileListExtension.showHidden`設定で制御
- **自動更新設定**: ファイルシステム変更時の自動更新を有効/無効化
  - `fileListExtension.autoRefresh`設定で制御
  - パフォーマンス最適化のため、大規模プロジェクトでは無効化可能
- **ファイル操作機能**:
  - ドラッグ&ドロップによるファイル・フォルダの移動
  - コピー、切り取り、貼り付け機能（Ctrl+C/X/V、Cmd+C/X/Vのキーボードショートカット対応）
  - 名前の変更（F2キー対応）
  - 削除機能（Deleteキー対応）
- **検索機能**: ワークスペース内のファイルを検索
- **Git変更ファイル**: 変更されたファイルを一覧表示し、差分を確認
  - ディレクトリ配下のファイルをグループ化して表示

### 改善
- **パフォーマンス最適化**: キャッシュ機能の実装
  - FileListProvider、FileDetailsProvider、WorkspaceExplorerProviderにキャッシュを追加
  - 不要なディレクトリ読み取りを削減
  - 大規模プロジェクトでのパフォーマンス向上
- **設定管理**: ConfigurationProviderサービスの実装
  - すべての設定を一元管理
  - 設定変更の監視機能
- **サービス指向アーキテクチャ**:
  - FileOperationService: ファイル操作を一元管理
  - SearchService: 検索機能を提供
  - DragDropHandler: ドラッグ&ドロップ処理を管理

### 変更
- **ドキュメント**: README.mdを大幅に更新
  - 機能をカテゴリ別に整理（表示機能、ファイル操作、カスタマイズ機能）
  - 詳細な設定セクションを追加
  - すべての設定項目の説明とデフォルト値を記載
  - 設定例のJSONコードを追加

### 修正
- ファイル名のソート時の`modifiedDate`プロパティの参照エラーを修正（`modified`に統一）

## [0.0.1] - 2024-09-27

### 追加
- 初回リリース
- **フォルダツリーペイン**: フォルダのみを表示し、階層構造をナビゲート
- **ファイル一覧ペイン**: 選択したフォルダ内のファイルとサブフォルダを表示
- **相対パス設定**: ワークスペースルートからの相対パスでデフォルトフォルダを指定
- **親フォルダへ移動**: ファイル一覧ペインから上位フォルダへ簡単移動
- **相対パスコピー**: ファイルを右クリックしてワークスペースからの相対パスをクリップボードにコピー
- **ファイル・フォルダ作成**: 新しいファイルやフォルダを簡単に作成
- **テンプレート機能**: `templates/file.md`でファイル作成時の初期内容をカスタマイズ
- **ワークスペース設定**: `.vscode/settings.json`を簡単に作成・編集
- **自動ビルド・リリース**: GitHub Actionsによる自動ビルドとリリース

[0.3.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.2.6...v0.3.0
[0.2.6]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.1.0...v0.2.5
[0.1.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/releases/tag/v0.0.1
