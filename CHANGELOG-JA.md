# Change Log

このプロジェクトのすべての重要な変更は、このファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [セマンティックバージョニング](https://semver.org/lang/ja/) に準拠しています。

## [0.8.3] - 2025-12-31

### 追加
- **Tasks View - パスヘッダーボタン**: パス表示ヘッダーにCopy Relative PathとRenameボタンを追加
  - Copy Relative Pathボタンで現在のディレクトリパスをクリップボードにコピー
  - Renameボタンで現在のディレクトリをインラインでリネーム可能
  - 両ボタンはArchiveボタンの横に表示

### 変更
- **Tasks View - リネーム後のナビゲーション**: ディレクトリリネーム後に自動的にリネーム後のディレクトリに移動
  - 以前は古い（無効な）パスに留まっていた
  - リネーム後のディレクトリ内容を即座に表示し、フィードバックを提供

### 改善
- **Editor View - 自動保存**: より多くのシナリオをカバーするよう自動保存機能を強化
  - Webviewが破棄される際に保存（サイドバーを閉じる場合など）
  - 拡張機能がdeactivateされる際に保存（VS Codeを閉じる場合など）
  - クリーンアップのためのDisposableインターフェースを適切に実装

## [0.8.2] - 2025-12-30

### 追加
- **Terminal View - タブ自動作成**: 最後のタブが閉じられた際に自動的に新しいターミナルタブを作成
  - 少なくとも1つのタブを維持することで、ターミナルが常に利用可能な状態を確保
  - 手動で新しいタブを作成する手間なくシームレスなユーザー体験を提供
- **Terminal View - 最下部へスクロールボタン**: ターミナルの最下部へスクロールするフローティングボタンを追加
  - 最下部からスクロールアップすると右下にボタンが表示
  - ボタンをクリックすると最新の出力にスクロールし、ターミナルにフォーカス
  - 最下部にいる時はボタンが自動的に非表示

## [0.8.1] - 2025-12-30

### 追加
- **Terminal View - Unicode対応**: xterm-addon-unicode11を追加し、CJK文字の幅計算を適切に実行
  - 日本語、中国語、韓国語などのUnicode文字が正しく表示されるように
  - ターミナル出力での文字配置のずれを修正

### 改善
- **Terminal View - レイアウト**: ターミナルのサイズ調整とフィット動作を改善
  - ターミナルがビューの幅いっぱいに正しく表示されるように
  - ターミナルビュー下部の隙間を修正
  - 初期ターミナルサイズ計算を改善

### 変更
- **Terminal View - スクロール動作**: 自動スクロール機能を削除
  - 新しい出力時にターミナルが自動的に最下部にスクロールしなくなった
  - ユーザーがスクロール位置を完全に制御可能

## [0.8.0] - 2025-12-30

### 技術的変更
- **コードリファクタリング**: extension.tsをモジュラーファイルに分割し、保守性を向上
  - `src/providers/`ディレクトリを作成（TasksProvider, EditorProvider, TerminalProvider, MenuProvider）
  - `src/providers/items/`ディレクトリを作成（FileItem, MenuItem TreeItemクラス）
  - `src/utils/`ディレクトリを作成（fileUtils, templateUtils, workspaceSetupユーティリティ）
  - extension.tsを約4,077行から約1,377行に削減
  - 循環参照を避けるためインターフェースベースの依存性注入（IEditorProvider, ITerminalProvider）を使用

### 変更
- **CLAUDE.md**: 新しいモジュラーアーキテクチャを反映してドキュメントを更新
- **README**: ドキュメント構造を再編成
  - Featuresセクションを概要テーブルと詳細な機能詳細セクションに分割
  - 拡張機能のメリットを強調する説明文に更新
  - 機能詳細をテーブル形式に変換して可読性を向上

## [0.7.38] - 2025-12-30

### 追加
- **Editor View - ショートカットオーバーレイ**: エディタに常時表示のキーボードショートカット案内を追加
  - 「Cmd+M / Ctrl+M - Create new markdown file」「Cmd+R / Ctrl+R - Run task in terminal」を表示
  - 右下に半透明のオーバーレイとして表示
  - 編集中も常に表示（テキスト入力を妨げない）

### 変更
- **Editor View - プレースホルダー**: プレースホルダーテキストを「Enter prompt here...」に変更し、用途を明確化

## [0.7.37] - 2025-12-30

### 追加
- **Terminal View - 複数タブ**: ターミナルの複数タブ機能を追加
  - 最大5つのターミナルタブを作成可能、各タブは独立したPTYセッションを持つ
  - シェル名と閉じるボタンを持つタブバーUI
  - 「+」ボタンで新規タブを作成
  - タブをクリックでセッション切り替え
  - 「×」ボタンで個別のタブを閉じる
  - ClearとKillボタンはアクティブタブに対して動作

## [0.7.36] - 2025-12-30

### 追加
- **Tasks View - パスヘッダーのArchiveボタン**: ルートディレクトリ以外にいる場合、パス表示ヘッダーにArchiveボタンを追加
  - クリックで現在のディレクトリをアーカイブし、自動的にルートに戻る
  - 他のディレクトリに移動せずにアーカイブ機能へ素早くアクセス可能

### 変更
- **UIメッセージ - 英語化**: すべてのユーザー向けメッセージを英語に変更
  - エラーメッセージ、成功通知、ダイアログのプロンプトが英語になりました
  - 対象ファイル: extension.ts, FileOperationService.ts, ContextMenuManager.ts, DragDropHandler.ts, ClipboardManager.ts, ExplorerManager.ts, SearchService.ts

## [0.7.35] - 2025-12-30

### 変更
- **Editor View - ディレクトリ移動時のクリア**: Tasks viewでディレクトリを移動した際にEditor viewのファイル選択をクリアするように変更
  - 以前は別のディレクトリに移動しても選択中のファイルが表示されたままだった
  - ディレクトリ移動時にエディタが未選択状態に戻るようになりました
  - 異なるディレクトリを閲覧する際のユーザー体験が向上

## [0.7.34] - 2025-12-29

### 追加
- **Tasks View - Show in File Listボタン**: ディレクトリの「Show in File List」インラインボタンを復活
  - クリックでそのディレクトリに移動し、内容を表示
  - Archiveボタンの前にインラインボタンとして表示

### 変更
- **Editor View - ボタンラベル**: 「Create Markdown File」ボタンのラベルを「New .md」に簡略化
  - Markdownファイル作成用のより簡潔で技術的なラベルに変更

## [0.7.33] - 2025-12-29

### 修正
- **Terminal View - リサイズ時のスクロール位置**: ビューのサイズ変更時にスクロール位置が最上部に移動してしまう問題を修正
  - 以前はターミナルビューをリサイズするとスクロール位置が最上部に移動していた
  - リサイズ後は常に最下部にスクロールするように変更し、ユーザー体験を改善
  - リサイズ後も常に最新のターミナル出力が表示されるようになりました

## [0.7.32] - 2025-12-29

### 追加
- **Tasks View - Archiveインラインボタン**: ディレクトリ行にArchiveボタンを直接追加
  - Tasksビューの各ディレクトリ行にArchiveアイコンがインライン表示
  - 右クリックコンテキストメニューなしでアーカイブ機能に素早くアクセス
  - 「Show in Panel」インラインボタンを削除（アーカイブの方がよく使用されるため）

## [0.7.31] - 2025-12-29

### 修正
- **Start Task - ファイル名形式**: Start Taskでファイル作成時に新しい形式が適用されていなかった問題を修正
  - Start Taskコマンドが旧形式 `MMDD.HHMM.SS_PROMPT.md` を使用していた
  - 新形式 `YYYY_MMDD_HHMM_SS_PROMPT.md` を正しく使用するように修正
  - すべてのファイル作成方法（Create Markdown FileとStart Task）でファイル名形式を統一

## [0.7.30] - 2025-12-29

### 変更
- **ファイル名形式**: Create Markdown Fileで作成されるファイル名の形式を変更
  - 旧形式: `MMDD.HHMM.SS_PROMPT.md`（例: `1229.0619.38_PROMPT.md`）
  - 新形式: `YYYY_MMDD_HHMM_SS_PROMPT.md`（例: `2025_1229_0619_38_PROMPT.md`）
  - 年プレフィックスを追加し、区切り文字をアンダースコアに統一

## [0.7.28] - 2025-12-29

### 変更
- **設定 - Run Commandデフォルト値**: `editor.runCommand`設定のデフォルト値を変更
  - 旧デフォルト値: `claude "read ${filePath} and save your report to the same directory as ${filePath}"`
  - 新デフォルト値: `claude "${filePath}"`
- **ファイル名形式**: Create Markdown Fileで作成されるファイル名の形式を変更
  - 旧形式: `YYYY_MMDD_HHMM_TASK.md`（例: `2025_1229_0619_TASK.md`）
  - 新形式: `MMDD.HHMM.SS_PROMPT.md`（例: `1229.0619.38_PROMPT.md`）
  - より正確なタイムスタンプのため秒を追加

### 追加
- **テンプレート変数**: ワークスペース相対パス用の新しいテンプレート変数を追加
  - `{{filepath}}`: ワークスペースルートからのファイルパス（例: `.claude/tasks/1229.0619.38_PROMPT.md`）
  - `{{dirpath}}`: ワークスペースルートからのディレクトリパス（例: `.claude/tasks`）

## [0.7.25] - 2025-12-29

### 変更
- **Tasks View - Start Task動作の変更**: Start Taskでディレクトリを作成する場所を変更
  - 以前: 常に`defaultRelativePath`（デフォルト: `.claude/tasks`）配下に作成
  - 変更後: Tasks Viewで現在開いているディレクトリ配下に作成
  - フォールバック: 現在のパスが取得できない場合は従来通り`defaultRelativePath`を使用

### 追加
- **Tasks View - 新規ディレクトリボタン**: Tasks Viewヘッダーに「New Directory」ボタンを追加
  - フォルダアイコンをクリックして現在のディレクトリ配下に新しいディレクトリを作成
  - ディレクトリのみを作成（Markdownファイルは作成しない）
  - ヘッダーボタンの順序: Start Task -> New Directory -> New File -> Refresh -> Settings

## [0.7.24] - 2025-12-29

### 追加
- **Tasks View - Editorにパスを挿入**: ファイル/フォルダのパスをEditorビューに挿入
  - Tasksビューでファイルやフォルダを右クリックして「Insert Path to Editor」を選択
  - Editorビューのカーソル位置に相対パスを挿入
  - 複数選択に対応 - 選択したすべてのパスが改行区切りで挿入される
  - 挿入後、Editorビューに自動的にフォーカス
- **Tasks View - Terminalにパスを挿入**: ファイル/フォルダのパスをTerminalビューに挿入
  - Tasksビューでファイルやフォルダを右クリックして「Insert Path to Terminal」を選択
  - Terminalビューに相対パスを挿入
  - 複数選択に対応 - パスはスペースで区切られる
  - ターミナルが起動していない場合は自動的に開始

## [0.7.23] - 2025-12-28

### 変更
- **Tasks View - テンプレート更新**: デフォルトのタスクテンプレートを更新
  - テンプレートにファイル名プレースホルダーを追加
  - テンプレートからバージョンセクションを削除

## [0.7.20] - 2025-12-27

### 変更
- **Tasks View - 設定の統合**: 「Folder Tree Settings」と「Docs Settings」を「Tasks Settings」に統合
  - 設定アイコンですべてのTasks関連設定を一箇所で表示
  - タイトルメニューのアイコン数を削減してシンプルに
- **Tasks View - メニュー順序**: タイトルメニューのアイコン順序を変更
  - 新しい順序: Start Task -> Create Markdown File -> Refresh -> Tasks Settings
  - Create Markdown FileをStart Taskの隣に配置してアクセスしやすく

## [0.7.19] - 2025-12-27

### 変更
- **Tasks View - タイトル**: タイトルを動的な「Tasks: パス」から固定の「TASKS」に変更
  - パスはタイトルではなくリストの先頭アイテムとして表示されるように
  - ルートディレクトリ: プロジェクトルートからの相対パスを表示（例: ".claude/tasks"）
  - サブディレクトリ: Tasksルートからの相対パスを表示（例: "v0.7.19"）
- **Editor View - Run時のフォーカス**: Runボタンをクリックした際にTerminal viewにフォーカスが移動するように変更
  - 以前はRun実行後もEditor viewにフォーカスが残っていた
  - ターミナルとの即座のインタラクションのため自動的にフォーカスを移動
- **Terminal View - スクロール位置**: リサイズ時にスクロール位置が最下部で維持されるように変更
  - ビューが最下部までスクロールされている状態でリサイズすると、最下部を維持
  - 上にスクロールしている場合は、そのスクロール位置を維持

## [0.7.18] - 2025-12-27

### 変更
- **Tasks View - フラットリスト表示**: ツリービューからフラットリスト表示に変更
  - 現在のディレクトリの内容のみを表示（ツリー展開なし）
  - ディレクトリをクリックでそのディレクトリに移動
  - ".."アイテムで親ディレクトリに戻る
  - タイトルにルートからの相対パスを動的に表示（例: "Tasks: subdir1/subdir2"）
- **Start Taskコマンド**: 作成したディレクトリに自動的に移動するように変更
  - Start Taskでディレクトリを作成後、ビューが新しいディレクトリの内容を表示
- **ビューのデフォルト表示**: 各ビューのデフォルト表示状態を変更
  - Menu: デフォルトで折りたたみ
  - Terminal: デフォルトで表示（以前は折りたたみ）

### 削除
- **Task Panel（ベータ版）**: Task Panel機能を完全に削除
  - `TaskPanelManager`クラスと関連機能を削除
  - `aiCodingSidebar.taskPanel.enabled`設定を削除
  - `aiCodingSidebar.taskPanel.nonTaskFilePosition`設定を削除
- **Active Panelsビュー**: サイドバーからActive Panelsビューを削除
  - このビューは開いているTask Panelの管理に使用されていました
- **Menu View - Beta Features**: MenuビューからBeta Featuresセクションを削除
- **Editor設定**: `aiCodingSidebar.editor.useTerminalView`設定を削除
  - Runボタンは常にTerminal viewにコマンドを送信するようになりました

## [0.7.17] - 2025-12-27

### 変更
- **名称変更**: 拡張機能の表記名を「AI Coding Sidebar」から「AI Coding Panel」に変更
  - アクティビティバータイトル、設定タイトル、ステータスバー、ターミナル名を更新
  - READMEとREADME-JAドキュメントを更新
- **Tasks View - ディレクトリクリック動作**: Task Panel設定に応じてディレクトリクリック時の動作を変更
  - `taskPanel.enabled: false`の場合: クリックで展開/折りたたみ（標準動作）
  - `taskPanel.enabled: true`の場合: クリックでTask Panelを開く（従来の動作）

### 削除
- **Tasks View - Selectedラベル**: ディレクトリの「Selected」ラベル表示を削除
  - Docsビュー連携のための旧機能で、不要となったため削除

## [0.7.16] - 2025-12-27

### 修正
- **Terminal View**: Marketplaceからインストールした際にターミナルが表示されない問題を修正
  - xterm.jsライブラリファイルをGit追跡対象に追加（`.gitignore`で除外されていた）
  - `.gitignore`を更新して`media/xterm/*.js`ファイルがVSIXパッケージに含まれるように

## [0.7.15] - 2025-12-27

### 追加
- **Terminal View - セッション維持**: ビューや拡張機能を切り替えてもターミナルセッションと出力履歴が保持されるように
  - Terminal viewの設定に`retainContextWhenHidden: true`を追加
  - ビューが非表示になってもターミナル出力バッファ（xterm.js）が維持される
  - 他のビューや拡張機能にフォーカスを移動しても、ターミナル履歴が失われなくなりました

## [0.7.14] - 2025-12-27

### 追加
- **Terminal View - クリック可能リンク**: ターミナル内のURLとファイルパスがクリック可能に
  - URLをクリックするとデフォルトブラウザで開く
  - ファイルパス（例: `./src/file.ts:123`）をクリックするとエディタで開く
  - ファイルパスの行番号指定に対応
  - xterm-addon-web-linksを使用したURL検出
  - カスタムリンクプロバイダーによるファイルパス検出

## [0.7.13] - 2025-12-27

### 変更
- **Tasks View - 統合階層表示**: TasksビューとDocsビューを単一の階層ツリービューに統合
  - ディレクトリ内にサブディレクトリとファイルをツリー構造で表示
  - ファイルはデフォルトで各ディレクトリ内で作成日時の昇順でソート
  - 別々のDocsビューを削除 - すべてのコンテンツがTasksに統合
  - ドラッグ&ドロップ機能をTasksビューに移植
  - ビュー数を削減してシンプルなサイドバーを実現

### 削除
- **Docs View**: 別々のDocsビューを削除
  - すべてのファイル閲覧機能がTasksビューに統合
  - ファイル操作（作成、名前変更、削除、コピー）はTasksのコンテキストメニューから利用可能

## [0.7.9] - 2025-12-27

### 変更
- **Active Panels View - デフォルト表示状態**: デフォルトの表示状態を「表示」から「折りたたみ」に変更
  - Active Panelsビューはサイドバーを開いた時にデフォルトで折りたたまれた状態になります
  - 開いているTask Panelの一覧を確認したい場合にユーザーが展開できます
  - Task Panelを頻繁に使用しないユーザーのサイドバーの視覚的な煩雑さを軽減

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
  - タイムスタンプ形式のファイル（形式：`YYYY_MMDD_HHMM.md`）でMarkdown Editor Viewで開かれるものはEditアイコンを表示
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

[0.8.2]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.38...v0.8.0
[0.7.38]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.37...v0.7.38
[0.7.37]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.36...v0.7.37
[0.7.36]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.35...v0.7.36
[0.7.35]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.34...v0.7.35
[0.7.34]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.33...v0.7.34
[0.7.33]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.32...v0.7.33
[0.7.32]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.31...v0.7.32
[0.7.31]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.30...v0.7.31
[0.7.30]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.28...v0.7.30
[0.7.28]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.25...v0.7.28
[0.7.25]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.24...v0.7.25
[0.7.24]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.23...v0.7.24
[0.7.23]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.20...v0.7.23
[0.7.20]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.19...v0.7.20
[0.7.19]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.18...v0.7.19
[0.7.18]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.17...v0.7.18
[0.7.17]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.16...v0.7.17
[0.7.16]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.15...v0.7.16
[0.7.15]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.14...v0.7.15
[0.7.14]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.13...v0.7.14
[0.7.13]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.11...v0.7.13
[0.7.9]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.8...v0.7.9
[0.7.8]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.7.6...v0.7.8
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
