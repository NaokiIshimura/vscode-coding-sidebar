# File List Extension

ワークスペース内のファイルとフォルダを効率的に閲覧できるVSCode拡張機能です。

## 機能

### 表示機能
- **フォルダツリーペイン**: フォルダのみを表示し、階層構造をナビゲート
- **ファイル一覧ペイン**: 選択したフォルダ内のファイルとサブフォルダを表示
- **ワークスペースエクスプローラー**: プロジェクト全体をツリー形式で表示
- **Git変更ファイル**: 変更されたファイルを一覧表示し、差分を確認

### ファイル操作
- **ファイル・フォルダ作成**: 新しいファイルやフォルダを簡単に作成
- **名前の変更**: ファイル・フォルダの名前を変更
- **削除**: ファイル・フォルダを削除（ゴミ箱に移動）
- **コピー・切り取り・貼り付け**: 標準的なファイル操作をサポート
- **ドラッグ&ドロップ**: ファイルやフォルダをドラッグして移動

### カスタマイズ機能
- **相対パス設定**: ワークスペースルートからの相対パスでデフォルトフォルダを指定
- **ファイルアイコン表示**: ファイル種別に応じた50種類以上のアイコンを自動表示
- **ソート機能**: 名前、種類、サイズ、更新日時でソート可能
- **隠しファイル表示**: 隠しファイル・フォルダの表示/非表示を切り替え
- **自動更新**: ファイルシステム変更時の自動更新を有効/無効化
- **テンプレート機能**: `templates/file.md`でファイル作成時の初期内容をカスタマイズ

### その他の機能
- **相対パスコピー**: ワークスペースエクスプローラーやファイル一覧ペインでファイルを右クリックしてワークスペースからの相対パスをクリップボードにコピー
- **親フォルダへ移動**: ファイル一覧ペインから上位フォルダへ簡単移動
- **検索機能**: ワークスペース内のファイルを検索

## 使用方法

### 基本操作
1. アクティビティバーの「File List」アイコンをクリック
2. フォルダツリーペインでフォルダを選択
3. ファイル一覧ペインでファイルとフォルダを確認
4. ファイルを右クリック → 「相対パスをコピー」でワークスペースからの相対パスをクリップボードにコピー

### 相対パスの設定

#### 方法1: ワークスペース設定（推奨）
1. フォルダツリーペインの歯車アイコン（⚙️）をクリック
2. 「ワークスペース設定」を選択
3. 設定したい項目を選択：
   - **settings.jsonを作成/編集**: ワークスペース設定ファイルを自動作成
   - **.claudeフォルダを設定**: .claudeフォルダを作成し設定を適用
   - **テンプレートをカスタマイズ**: ファイル作成時のテンプレートを編集

#### 方法2: 拡張機能から設定
1. フォルダツリーペインの編集アイコン（✏️）をクリック
2. 相対パスを入力（例: `src`, `.claude`, `docs/api`）
3. 設定に保存するか選択

#### 方法3: 設定画面から
1. フォルダツリーペインの設定アイコンをクリック
2. `fileListExtension.defaultRelativePath` を編集

### 相対パスの例
- `src` → プロジェクト/src
- `docs/api` → プロジェクト/docs/api  
- `.claude` → プロジェクト/.claude
- 空文字 → プロジェクトルート

### ファイル・フォルダの作成

#### ファイル作成
- フォルダツリーペインまたはファイル一覧ペインの「+」アイコンをクリック
- タイムスタンプ付きのMarkdownファイルが作成されます（例: `2025_0927_1346.md`）

#### フォルダ作成
- フォルダツリーペインまたはファイル一覧ペインのフォルダアイコンをクリック
- フォルダ名を入力して作成

### テンプレート機能

ファイル作成時の初期内容をカスタマイズできます。

#### テンプレートの設定方法
1. フォルダツリーペインの歯車アイコン（⚙️）をクリック
2. 「ワークスペース設定」→「テンプレートをカスタマイズ」を選択
3. `.vscode/templates/file.md` が作成されます
4. テンプレートを編集して保存

#### デフォルトテンプレート
初回作成時には以下のテンプレートが設定されます：

```markdown
作成日時: {{datetime}}

---

# {{filename}}

## 概要


## 詳細


## メモ
```

#### 使用可能な変数
- `{{datetime}}`: 作成日時（例: 2025/9/27 13:46:54）
- `{{filename}}`: ファイル名（拡張子を含む、例: 2025_0927_1346.md）
- `{{timestamp}}`: タイムスタンプ（例: 2025_0927_1346）

#### テンプレートの優先順位
1. ワークスペースの `.vscode/templates/file.md`（存在する場合）
2. 拡張機能内のデフォルトテンプレート（`templates/file.md`）

## 設定

### 利用可能な設定

#### fileListExtension.defaultRelativePath
- **説明**: フォルダツリーのデフォルト相対パス
- **型**: string
- **デフォルト値**: `""`（プロジェクトルート）
- **例**: `"src"`, `".claude"`, `"docs/api"`

#### fileListExtension.sortBy
- **説明**: ファイルのソート基準
- **型**: string
- **デフォルト値**: `"name"`
- **選択肢**:
  - `"name"`: 名前でソート
  - `"type"`: 種類でソート
  - `"size"`: サイズでソート
  - `"modified"`: 更新日時でソート

#### fileListExtension.sortOrder
- **説明**: ソート順序
- **型**: string
- **デフォルト値**: `"ascending"`
- **選択肢**:
  - `"ascending"`: 昇順
  - `"descending"`: 降順

#### fileListExtension.showHidden
- **説明**: 隠しファイル・フォルダを表示する
- **型**: boolean
- **デフォルト値**: `false`

#### fileListExtension.showFileIcons
- **説明**: ファイルアイコンを表示する
- **型**: boolean
- **デフォルト値**: `true`

#### fileListExtension.autoRefresh
- **説明**: ファイルシステム変更時に自動更新する
- **型**: boolean
- **デフォルト値**: `true`

#### fileListExtension.viewMode
- **説明**: 表示モード
- **型**: string
- **デフォルト値**: `"tree"`
- **選択肢**:
  - `"tree"`: ツリー表示
  - `"list"`: リスト表示

### 設定例

`.vscode/settings.json`に以下のように記述できます:

```json
{
  "fileListExtension.defaultRelativePath": ".claude",
  "fileListExtension.sortBy": "modified",
  "fileListExtension.sortOrder": "descending",
  "fileListExtension.showHidden": false,
  "fileListExtension.showFileIcons": true,
  "fileListExtension.autoRefresh": true,
  "fileListExtension.viewMode": "tree"
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
- **デバッグパネル**: サイドバーの実行とデバッグアイコン → 「Run Extension」を選択 → 緑の▶️ボタンをクリック
- **メニューバー**: 「実行」→「デバッグの開始」を選択

### デバッグ中の操作
- 新しいVSCodeウィンドウ（Extension Development Host）が開く
- アクティビティバーに「File List」アイコンが表示される
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
   code --install-extension file-list-extension-0.0.1.vsix
   ```
3. VS Codeを再起動

#### ローカルビルド版を使用する場合:
```bash
# releasesディレクトリから直接インストール（バージョン0.0.1）
code --install-extension releases/file-list-extension-0.0.1.vsix
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
   code --install-extension releases/file-list-extension-0.0.1.vsix
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
npm run version:patch   # 0.0.1 → 0.0.2
npm run version:minor   # 0.0.1 → 0.1.0  
npm run version:major   # 0.0.1 → 1.0.0
```

## アンインストール

### コマンドラインから
```bash
code --uninstall-extension file-list-extension
```

### VSCode内から
1. 拡張機能サイドバーを開く（`Ctrl+Shift+X` / `Cmd+Shift+X`）
2. インストール済みの拡張機能から「File List」を検索
3. アンインストールボタンをクリック

## 要件

- VSCode 1.74.0 以上
- Node.js (開発時のみ)
