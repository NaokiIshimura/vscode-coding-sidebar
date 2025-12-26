# Change Log

このプロジェクトのすべての重要な変更は、このファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [セマンティックバージョニング](https://semver.org/lang/ja/) に準拠しています。

## [0.7.8] - 2025-12-27

### 追加
- **Menu - Shortcut**: Shortcutセクションに「Duplicate Workspace in New Window」を追加
  - 現在のワークスペースを新しいVSCodeウィンドウで複製して開く
  - VSCodeのビルトインコマンド `workbench.action.duplicateWorkspaceInNewWindow` を使用

## [0.4.6] - 2025-11-09

### 追加
- **Markdown List - ソート順のカスタマイズ**: マークダウンファイルのソート方法をカスタマイズする設定を追加
  - 新しい設定 `aiCodingSidebar.markdownList.sortBy`: ソート基準を選択（name、created、modified）
  - 新しい設定 `aiCodingSidebar.markdownList.sortOrder`: ソート方向を選択（ascending、descending）
  - 設定変更は更新不要でリアルタイムに反映されます
- **Markdown List - ソート順の表示**: 現在のソート順がビュータイトルに表示されるように変更
  - ソート基準と方向を表示（例：「Markdown List (Created ↑)」）
  - 設定変更時に自動的に更新されます
  - 現在ファイルがどのようにソートされているかが一目で分かります

### 変更
- **Markdown List - デフォルトソート順**: デフォルトのファイルソート順を名前（昇順）から作成日時（昇順）に変更
  - ファイルはデフォルトで作成日時の昇順でソートされるようになりました
  - タイムスタンプ形式のファイル（例：`2025_1109_1230.md`）が自然な時系列順に表示されます
  - 以前の動作（名前順）は`aiCodingSidebar.markdownList.sortBy`を"name"に変更することで復元できます

## [0.4.5] - 2025-11-09

### 修正
- **Markdown Editorの状態維持**: 拡張機能がアクティブ/非アクティブになった際にMarkdown Editorがファイル状態を失う問題を修正
  - 以前は、拡張機能サイドバーが非アクティブから再びアクティブになると、Markdown Editorが空の状態になっていました
  - markdownEditorビューの設定に`retainContextWhenHidden: true`を追加し、非表示時もwebviewのコンテキストを保持するようにしました
  - `onDidChangeVisibility`リスナーを追加し、ビューが表示されたときにファイル内容を復元するようにしました
  - webview準備完了メッセージのハンドリングを追加し、webview初期化後のファイル復元を確実にしました
  - 現在は、拡張機能が再度アクティブになった際に、以前選択していたファイルが自動的に復元されます
  - 拡張機能のライフサイクル変更を通じてシームレスな編集体験を維持します

## [0.4.4] - 2025-11-09

### 変更
- **ビュータイトルの簡素化**: すべてのビュータイトルをよりシンプルに変更
  - Directory List: タイトルから相対パスを削除し、「Directory List」のみを表示
  - Markdown List: タイトルから相対パスを削除し、「Markdown List」のみを表示
  - すべてのビューで一貫性のあるシンプルなインターフェースを提供
- **Markdown List - ディレクトリヘッダー**: ファイルリストの上部にディレクトリ名の表示を追加
  - Directory Listルートからの相対パスとして現在のディレクトリパスを表示
  - Markdown Editorのファイル名表示と同様の一貫性を提供
  - タイトルを煩雑にせずに、どのディレクトリを閲覧しているかが明確になります
- **Markdown List - 編集中ファイルのインジケーター**: Markdown Editorで編集中のファイルに「editing」インジケーターを追加
  - Markdown Editor Viewで現在編集中のファイルには、説明に「editing」が表示されます
  - 手動で更新することなく、ファイル切り替え時に自動的に更新されます
  - サイドバーでアクティブに編集されているファイルを特定しやすくなります
- **Markdown Editor - タイトル表示**: ファイル名のみを表示するようにタイトルを簡素化
  - 以前はプロジェクトルートからの完全な相対パスを表示していました
  - 現在はより洗練されたUIのためにファイル名のみを表示します
- **Markdown Editor - フォルダ切り替え時の自動クリア**: Markdown Listでフォルダを切り替えた際にエディタがクリアされるように変更
  - 以前のフォルダのファイルを表示したままにすることで混乱を防ぎます
  - 異なるディレクトリに移動した際にエディタの状態を自動的にリセットします
- **Directory List - Add Directoryの動作**: 「Add Directory」コマンドが常にDirectory Listルートにディレクトリを作成するように変更
  - 以前はコンテキストメニューから呼び出された際に、選択されたディレクトリ配下にディレクトリを作成していました
  - 現在はコマンドの呼び出し方法に関わらず、常にDirectory Listのルートディレクトリにディレクトリを作成します
  - ディレクトリ作成の動作がより予測可能になります

## [0.4.3] - 2025-11-09

### 変更
- **Directory Listの自動選択**: 新規作成されたディレクトリがDirectory Listビューで自動的に選択されるように変更
  - "Add Directory"コマンドでディレクトリを作成すると、新しいディレクトリが即座に選択されます
  - ディレクトリ作成後の視覚的フィードバックとナビゲーションが改善されました
- **Markdownファイルアイコン**: Markdown Listビューのファイルが開き方に応じて異なるアイコンを表示するように変更
  - タイムスタンプ形式のファイル（形式：`YYYY_MMDD_HHMM.md`）でMarkdown Editor Viewで開かれるものはEditアイコン（✏️）を表示
  - その他の通常のエディタで開かれるMarkdownファイルはMarkdownアイコンを表示
  - サイドバーで直接編集できるファイルと通常のエディタで開くファイルの違いがより明確になりました

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

### 追加
- **新規ディレクトリでのMarkdownファイル自動作成**: Add Directoryコマンドでタイムスタンプ付きMarkdownファイルを自動作成
  - 新しいディレクトリを作成すると、その中に自動的にMarkdownファイルが作成されます
  - ファイルは自動的にエディタで開かれ、すぐに使用できます
  - AIコーディングタスクの整理をシームレスに行えるワークフローを提供

### 変更
- **デフォルト相対パス**: デフォルト値を空文字列から".ai/tasks"に変更
  - 新規インストール時に自動的に".ai/tasks"ディレクトリが開かれるようになりました
  - AIコーディングワークフローに適した初期設定を提供
- **コマンド名の更新**: 一貫性のため"Add Folder"を"Add Directory"に変更
- **タイムスタンプのロケール**: タイムスタンプ形式を日本語固定からシステムロケール使用に変更
  - Markdownファイル作成時に`toLocaleString()`を使用し、ユーザーのシステムロケール設定を尊重
  - 国際化対応を改善

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

[0.3.6]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.2.6...v0.3.0
[0.2.6]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.1.0...v0.2.5
[0.1.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/releases/tag/v0.0.1
