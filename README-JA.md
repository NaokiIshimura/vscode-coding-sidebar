# AI Coding Panel

AIコーディングツールとの連携を強化するサイドバー拡張機能。
ファイルとフォルダを効率的に閲覧・管理し、AIとのコーディング作業をスムーズに。

## 機能

| 機能 | 説明 |
| --- | --- |
| **Tasks** | 指定したディレクトリ配下のフォルダとファイルをフラットリストで表示<br>settingsでデフォルトのパスを設定できる<br>ディレクトリとファイルを作成できる<br>**フラットリスト表示**: 現在のディレクトリの内容のみを表示（ツリー構造ではない）<br>**ディレクトリナビゲーション**: ディレクトリをクリックでそのディレクトリに移動。".."で親ディレクトリに戻る<br>**パス表示**: 現在のパスをリストの先頭アイテムとして表示<br>ファイルはデフォルトで作成日時の昇順でソート<br>**ドラッグ&ドロップ**: ビュー内または外部からのファイルをドラッグしてコピー<br>**自動更新**: ファイルが作成、変更、削除されたときに自動的に更新<br>**設定アイコン**: デフォルトパスとソート設定へのクイックアクセス |
| **Editor** | サイドバー内でMarkdownファイルを直接編集可能<br>タイムスタンプ形式のMarkdownファイル（形式: `YYYY_MMDD_HHMM_SS_PROMPT.md`）を選択すると自動的に表示<br>その他のMarkdownファイルは通常のエディタで開く<br>ヘッダーのSaveボタンで保存（ファイル未開時は現在のTasksディレクトリに新規作成）<br>`Cmd+R` / `Ctrl+R`でカスタマイズ可能なコマンドをターミナルに送信（実行前に自動保存、ファイル未開でも実行可能）<br>`Cmd+M` / `Ctrl+M`で新しいMarkdownファイルを作成<br>**Saveボタン**: ヘッダーに表示され、未保存の変更がある場合は色が変わる<br>**カスタマイズ可能な実行コマンド**: Runボタンで実行されるコマンドを設定でカスタマイズ可能<br>**ファイル未開でも実行可能**: ファイルを開いていない状態でもエディタの内容を使用してコマンドを実行<br>**Terminalビュー連携**: Runコマンドを埋め込みTerminalビューに送信可能（設定で変更可能）<br>VSCodeエディタでファイルがアクティブになると自動的に読み取り専用モードに切り替わる<br>別の拡張機能やファイルに切り替える際に自動保存<br>別の拡張機能から戻ってきたときに編集中のファイルを復元<br>**設定アイコン**: 実行コマンド設定へのクイックアクセス |
| **Terminal** | xterm.jsを使用したサイドバー埋め込みターミナル<br>完全なPTYサポートによるシェルコマンド実行<br>**複数タブ**: 最大5つのターミナルタブを作成可能。各タブは独立したセッションを持つ。「+」ボタンで新規タブ追加、タブクリックで切り替え、「×」で閉じる<br>**セッション維持**: ビューや拡張機能を切り替えてもターミナルセッションと出力履歴が保持される<br>**クリック可能リンク**: URLはブラウザで開き、ファイルパス（例: `./src/file.ts:123`）はエディタで行番号指定して開く<br>**設定可能**: シェルパス、フォントサイズ、フォントファミリー、カーソルスタイル、カーソル点滅、スクロールバック行数をカスタマイズ可能<br>**WebViewヘッダー**: タブバーにシェル名を表示、アクティブタブ用のClear、Killボタン<br>**設定アイコン**: タイトルバーからターミナル設定へのクイックアクセス<br>**デフォルト表示**: 折りたたみ（必要に応じて展開） |
| **Menu** | ユーザ設定を開く<br>グローバル設定を開く<br>テンプレートをカスタマイズ<br>ショートカット機能: ターミナルを開く、デフォルトブランチへ切り替え、Git pull、新しいウィンドウでワークスペースを複製 |

## 使用方法

### キーボードショートカット

| ショートカット | 動作 |
| --- | --- |
| `Cmd+Shift+A` (macOS)<br>`Ctrl+Shift+A` (Windows/Linux) | AI Coding Panelにフォーカス |
| `Cmd+S` (macOS)<br>`Ctrl+S` (Windows/Linux) | 新規タスク（サイドバーにフォーカス時） |
| `Cmd+M` (macOS)<br>`Ctrl+M` (Windows/Linux) | Markdownファイルを新規作成（サイドバーにフォーカス時） |
| `Cmd+R` (macOS)<br>`Ctrl+R` (Windows/Linux) | Editorでタスクを実行（自動保存してターミナルにコマンドを送信） |

### 基本操作
1. アクティビティバーの「AI Coding Panel」アイコンをクリック（または`Cmd+Shift+A` / `Ctrl+Shift+A`を押す）
2. TasksでAIコーディング用のディレクトリを作成
3. Docsでmarkdownファイルを作成
4. Docsでタイムスタンプ形式のMarkdownファイル（例: `2025_1229_1430_25_PROMPT.md`）をクリックして、下部のEditorビューで編集。その他のMarkdownファイルは通常のエディタで開く
5. EditorでAIへの指示を記述し、Saveボタンで保存
6. Docsでファイルを右クリック -> 相対パスをコピー
7. AIへ相対パスをペースト


## テンプレート機能

Docsでファイルを作成する際、テンプレートを使用して初期内容を自動設定できます。
AIコーディングで使用するmarkdownファイルの構造を統一し、作業効率を向上させます。

### テンプレートの設定方法
1. Tasksペインの歯車アイコンをクリック
2. 「ワークスペース設定」->「テンプレートをカスタマイズ」を選択
3. `.vscode/ai-coding-sidebar/templates/task.md` が作成されます
4. テンプレートを編集して保存

### デフォルトテンプレート
初回作成時には以下のテンプレートが設定されます：

```markdown
file: {{filename}}
created: {{datetime}}

---

# task

```

### 使用可能な変数
テンプレート内で以下の変数が使用できます：

- `{{datetime}}`: 作成日時（例: 2025/11/3 12:27:13）
- `{{filename}}`: ファイル名（拡張子を含む、例: 2025_1229_1430_25_PROMPT.md）
- `{{timestamp}}`: タイムスタンプ（例: 2025_1229_1430_25）
- `{{filepath}}`: ワークスペースルートからのファイルパス（例: .claude/tasks/2025_1229_1430_25_PROMPT.md）
- `{{dirpath}}`: ワークスペースルートからのディレクトリパス（例: .claude/tasks）

### テンプレートの優先順位
1. ワークスペースの `.vscode/ai-coding-sidebar/templates/task.md`（存在する場合）
2. 拡張機能内のデフォルトテンプレート

### テンプレートの活用例
- AIへの指示内容を記録するための「overview」セクション
- 実施すべき作業を列挙する「tasks」セクション
- プロジェクト固有の情報を追加するカスタムセクション


## ファイル操作

| 機能 | 説明 |
| --- | --- |
| ファイル・フォルダ作成 | 新しいファイルやフォルダを簡単に作成 |
| 名前の変更 | ファイル・フォルダの名前を変更 |
| 削除 | ファイル・フォルダを削除（ゴミ箱に移動） |
| コピー・切り取り・貼り付け | 標準的なファイル操作をサポート |
| ドラッグ&ドロップ | Docsビュー内または外部からファイルをドラッグしてコピー。コピー成功時にメッセージを表示 |
| アーカイブ | タスクディレクトリをアーカイブしてワークスペースを整理。ディレクトリ行のアーカイブアイコン（インラインボタン）をクリックするか、右クリックして「Archive」を選択すると、`archived`フォルダに移動されます。ルートディレクトリ以外のディレクトリ内にいる場合は、パス表示ヘッダーにもアーカイブボタンが表示され、クリックすると現在のディレクトリをアーカイブしてルートに戻ります。同名のディレクトリが既に存在する場合は、競合を避けるために自動的にタイムスタンプが追加されます。 |
| ブランチチェックアウト | ディレクトリを右クリックして、ディレクトリ名をそのままブランチ名としてgitブランチをチェックアウト。ブランチが存在しない場合は作成し、既に存在する場合は切り替え |
| Editorにパスを挿入 | Tasksビューでファイルを右クリックして「Insert Path to Editor」を選択すると、Editorビューのカーソル位置に相対パスを挿入。複数選択に対応 |
| Terminalにパスを挿入 | Tasksビューでファイルを右クリックして「Insert Path to Terminal」を選択すると、Terminalビューに相対パスを挿入。複数選択に対応。パスはスペースで区切られます |

## その他の機能

### ファイル・フォルダの作成

| 項目 | 手順 |
| --- | --- |
| New Task | Tasksのタイトルメニューにあるロケットアイコンをクリック<br>Tasks Viewで現在開いているディレクトリ配下に新しいディレクトリを作成し、タイムスタンプ付きのMarkdownファイルを自動生成します<br>作成されたファイルはTasksで「editing」ラベルとともに選択され、Editor Viewで開かれます<br>現在のパスが取得できない場合は、デフォルトパス配下に作成されます |
| 新規ディレクトリ | Tasksのフォルダアイコンをクリック<br>現在開いているディレクトリ配下に新しいディレクトリを作成します（Markdownファイルは作成しない） |
| ファイル作成 | Docsの「+」アイコンをクリック<br>タイムスタンプ付きのMarkdownファイルが作成され、Editor Viewで開かれます（例: `2025_1229_1430_25_PROMPT.md`） |

### 相対パスの設定

| 方法 | 手順 |
| --- | --- |
| Tasks設定から（推奨） | 1. Tasksの歯車アイコンをクリック<br>2. 設定画面が開き、`aiCodingSidebar.defaultRelativePath`がフィルタ表示される<br>3. デフォルトの相対パスを編集（例: `src`, `.claude`, `docs/api`） |
| ワークスペース設定 | 1. Tasksの歯車アイコンをクリック<br>2. 「ワークスペース設定」を選択<br>3. 設定したい項目を選択：<br>&nbsp;&nbsp;- **settings.jsonを作成/編集**: ワークスペース設定ファイルを自動作成<br>&nbsp;&nbsp;- **.claudeフォルダを設定**: .claudeフォルダを作成し設定を適用<br>&nbsp;&nbsp;- **テンプレートをカスタマイズ**: ファイル作成時のテンプレートを編集 |
| 拡張機能から設定 | 1. Tasksの編集アイコンをクリック<br>2. 相対パスを入力（例: `src`, `.claude`, `docs/api`）<br>3. 設定に保存するか選択 |

#### 相対パスの例
- `src` -> プロジェクト/src
- `docs/api` -> プロジェクト/docs/api
- `.claude` -> プロジェクト/.claude
- 空文字 -> プロジェクトルート

#### 設定したパスが存在しない場合
デフォルトの相対パスが存在しない場合、Tasksに「ディレクトリを作成」ボタンが表示されます。ボタンをクリックすると、自動的にディレクトリが作成され、その内容が表示されます。

### その他

| 機能 | 説明 |
| --- | --- |
| 相対パスコピー | ワークスペースからの相対パスをクリップボードにコピー |
| Tasks設定 | Tasksから設定画面を開き、デフォルトの相対パスを直接編集 |
| 検索機能 | ワークスペース内のファイルを検索 |

## 設定

| 設定項目 | 説明 | 型 | デフォルト値 | 選択肢/例 |
| --- | --- | --- | --- | --- |
| `defaultRelativePath` | Tasksのデフォルト相対パス | string | `".claude/tasks"` | `"src"`, `".claude"`, `"docs/api"` |
| `markdownList.sortBy` | Docsのファイルのソート基準 | string | `"created"` | `"name"`: ファイル名<br>`"created"`: 作成日時<br>`"modified"`: 更新日時 |
| `markdownList.sortOrder` | Docsのファイルのソート順序 | string | `"ascending"` | `"ascending"`: 昇順<br>`"descending"`: 降順 |
| `editor.runCommand` | Editorビューのrunボタンで実行されるコマンドテンプレート | string | `claude "${filePath}"` | `${filePath}`をファイルパスのプレースホルダーとして使用 |
| `editor.runCommandWithoutFile` | ファイル未開時にrunボタンで実行されるコマンドテンプレート | string | `claude "${editorContent}"` | `${editorContent}`をエディタ内容のプレースホルダーとして使用 |
| `terminal.shell` | Terminalビューのシェル実行パス | string | `""` | 空欄の場合はシステムのデフォルトシェルを使用 |
| `terminal.fontSize` | Terminalビューのフォントサイズ | number | `12` | 任意の正の数値 |
| `terminal.fontFamily` | Terminalビューのフォントファミリー | string | `"monospace"` | 任意の有効なフォントファミリー |
| `terminal.cursorStyle` | Terminalビューのカーソルスタイル | string | `"block"` | `"block"`, `"underline"`, `"bar"` |
| `terminal.cursorBlink` | Terminalビューのカーソル点滅を有効化 | boolean | `true` | `true`または`false` |
| `terminal.scrollback` | Terminalビューのスクロールバック行数 | number | `1000` | 任意の正の数値 |

### 設定例

`.vscode/settings.json`に以下のように記述できます:

```json
{
  "aiCodingSidebar.defaultRelativePath": ".claude",
  "aiCodingSidebar.markdownList.sortBy": "created",
  "aiCodingSidebar.markdownList.sortOrder": "ascending",
  "aiCodingSidebar.editor.runCommand": "claude \"${filePath}\"",
  "aiCodingSidebar.editor.runCommandWithoutFile": "claude \"${editorContent}\"",
  "aiCodingSidebar.terminal.fontSize": 12,
  "aiCodingSidebar.terminal.cursorStyle": "block"
}
```

## 開発・ビルド

```bash
# 依存関係のインストール
npm install

# TypeScriptのコンパイル
npm run compile

# 開発時の自動コンパイル
npm run watch
```

## デバッグ方法

### 準備
1. 依存関係をインストール: `npm install`
2. TypeScriptをコンパイル: `npm run compile`

### デバッグの開始

#### コマンドパレットから起動（推奨）
1. `Ctrl+Shift+P` (Windows/Linux) または `Cmd+Shift+P` (Mac) でコマンドパレットを開く
2. 「Debug: Start Debugging」と入力して選択
3. Enterキーを押して実行

#### その他の起動方法
- **F5キー**: デバッグを即座に開始
- **デバッグパネル**: サイドバーの実行とデバッグアイコン -> 「Run Extension」を選択 -> 緑の再生ボタンをクリック
- **メニューバー**: 「実行」->「デバッグの開始」を選択

### デバッグ中の操作
- 新しいVSCodeウィンドウ（Extension Development Host）が開く
- アクティビティバーに「AI Coding Panel」アイコンが表示される
- ブレークポイントの設定、変数の検査、ステップ実行が可能
- `Ctrl+R` / `Cmd+R` で拡張機能をリロード

## インストール

### 方法1: 開発モード（テスト用）
1. このプロジェクトをクローンまたはダウンロード
2. VSCodeで開く
3. `F5`キーを押して拡張機能開発ホストを起動
4. 新しいVSCodeウィンドウで拡張機能をテスト

### 方法2: VSIXパッケージからインストール

#### GitHub Releasesから最新版を使用する場合（推奨）:
1. [GitHubのReleasesページ](https://github.com/NaokiIshimura/vscode-panel/releases)から最新のVSIXファイルをダウンロード
2. コマンドラインからインストール:
   ```bash
   code --install-extension ai-coding-sidebar-0.7.37.vsix
   ```
3. VS Codeを再起動

#### ローカルビルド版を使用する場合:
```bash
# releasesディレクトリから直接インストール
code --install-extension releases/ai-coding-sidebar-0.7.36.vsix
```

#### 自分でパッケージを作成する場合:
1. VSCEツールをインストール:
   ```bash
   npm install -g @vscode/vsce
   ```
2. VSIXパッケージを作成:
   ```bash
   npm run package
   ```
3. 生成されたVSIXファイルをインストール:
   ```bash
   code --install-extension releases/ai-coding-sidebar-0.7.36.vsix
   ```
4. VS Codeを再起動

## 自動ビルド・リリース

このプロジェクトではGitHub Actionsを使用した自動ビルドとリリースを行っています。

### 自動ビルドの仕組み
- **トリガー**: masterブランチへのプッシュ時
- **ビルドプロセス**:
  1. TypeScriptコンパイル
  2. VSIXパッケージの自動作成
  3. GitHub Releasesへの自動アップロード
  4. リポジトリ内 `releases/` ディレクトリの更新

### バージョン管理
package.jsonのversionフィールドに基づいてリリースタグが作成されます。

```bash
# バージョンアップのスクリプト
npm run version:patch   # 0.0.1 -> 0.0.2
npm run version:minor   # 0.0.1 -> 0.1.0
npm run version:major   # 0.0.1 -> 1.0.0
```

## アンインストール

### コマンドラインから
```bash
code --uninstall-extension ai-coding-sidebar
```

### VSCode内から
1. 拡張機能サイドバーを開く（`Ctrl+Shift+X` / `Cmd+Shift+X`）
2. インストール済みの拡張機能から「AI Coding Panel」を検索
3. アンインストールボタンをクリック

## 要件

- VSCode 1.74.0 以上
- Node.js (開発時のみ)
