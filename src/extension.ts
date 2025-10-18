import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

// サービスクラスのインポート
import { ExplorerManager } from './services/ExplorerManager';
import { FileOperationService } from './services/FileOperationService';
import { ClipboardManager } from './services/ClipboardManager';
import { MultiSelectionManager } from './services/MultiSelectionManager';
import { KeyboardShortcutHandler } from './services/KeyboardShortcutHandler';
import { ContextMenuManager } from './services/ContextMenuManager';
import { DragDropHandler } from './services/DragDropHandler';
import { SearchService } from './services/SearchService';
import { ConfigurationProvider } from './services/ConfigurationProvider';

// テンプレートを読み込んで変数を置換する関数
function loadTemplate(context: vscode.ExtensionContext, variables: { [key: string]: string }): string {
    try {
        let templatePath: string;
        
        // 1. ワークスペースの.vscode/templates/file.mdを優先
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            const vscodeTemplatePath = path.join(workspaceRoot, '.vscode', 'templates', 'file.md');
            if (fs.existsSync(vscodeTemplatePath)) {
                templatePath = vscodeTemplatePath;
            } else {
                // 2. 拡張機能内のfile.mdをフォールバック
                templatePath = path.join(context.extensionPath, 'templates', 'file.md');
            }
        } else {
            templatePath = path.join(context.extensionPath, 'templates', 'file.md');
        }
        
        if (fs.existsSync(templatePath)) {
            let content = fs.readFileSync(templatePath, 'utf8');
            
            // 変数を置換
            for (const [key, value] of Object.entries(variables)) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                content = content.replace(regex, value);
            }
            
            return content;
        }
    } catch (error) {
        console.error(`テンプレートの読み込みに失敗しました: ${error}`);
    }
    
    // テンプレートが見つからない場合のデフォルト
    return `作成日時: ${variables.datetime}\n\n---\n\n\n`;
}

// settings.jsonを設定するヘルパー関数
async function setupSettingsJson(workspaceRoot: string): Promise<void> {
    const vscodeDir = path.join(workspaceRoot, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');

    try {
        // .vscodeディレクトリを作成（存在しない場合）
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        let settings: any = {};
        
        // 既存のsettings.jsonを読み込み
        if (fs.existsSync(settingsPath)) {
            try {
                const content = fs.readFileSync(settingsPath, 'utf8');
                settings = JSON.parse(content);
            } catch (error) {
                console.error('settings.jsonの解析に失敗しました:', error);
            }
        }

        // デフォルト設定を追加
        if (!settings.hasOwnProperty('fileListExtension.defaultRelativePath')) {
            settings['fileListExtension.defaultRelativePath'] = '.claude';
        }

        // settings.jsonに書き込み
        const settingsContent = JSON.stringify(settings, null, 2);
        fs.writeFileSync(settingsPath, settingsContent, 'utf8');

        // ファイルを開く
        const document = await vscode.workspace.openTextDocument(settingsPath);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage('settings.jsonを作成/更新しました');
    } catch (error) {
        vscode.window.showErrorMessage(`settings.jsonの作成に失敗しました: ${error}`);
    }
}

// テンプレートを設定するヘルパー関数
async function setupTemplate(workspaceRoot: string): Promise<void> {
    const templatesDir = path.join(workspaceRoot, '.vscode', 'templates');
    const templatePath = path.join(templatesDir, 'file.md');

    try {
        // .vscode/templatesディレクトリを作成（存在しない場合）
        if (!fs.existsSync(templatesDir)) {
            fs.mkdirSync(templatesDir, { recursive: true });
        }

        // デフォルトテンプレート内容
        const defaultTemplate = `作成日時: {{datetime}}

---

# {{filename}}

## 概要


## 詳細


## メモ
`;

        // テンプレートファイルが存在しない場合のみ作成
        if (!fs.existsSync(templatePath)) {
            fs.writeFileSync(templatePath, defaultTemplate, 'utf8');
        }

        // ファイルを開く
        const document = await vscode.workspace.openTextDocument(templatePath);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage('テンプレートファイルを開きました。編集して保存してください。');
    } catch (error) {
        vscode.window.showErrorMessage(`テンプレートファイルの作成に失敗しました: ${error}`);
    }
}

// .claudeフォルダを設定するヘルパー関数
async function setupClaudeFolder(workspaceRoot: string): Promise<void> {
    try {
        // .claudeフォルダを作成（存在しない場合）
        const claudeDir = path.join(workspaceRoot, '.claude');
        if (!fs.existsSync(claudeDir)) {
            fs.mkdirSync(claudeDir, { recursive: true });
        }

        // settings.jsonも更新
        await setupSettingsJson(workspaceRoot);

        // 設定を適用
        const config = vscode.workspace.getConfiguration('fileListExtension');
        await config.update('defaultRelativePath', '.claude', vscode.ConfigurationTarget.Workspace);

        vscode.window.showInformationMessage('.claudeフォルダを作成し、設定を更新しました');
    } catch (error) {
        vscode.window.showErrorMessage(`.claudeフォルダの設定に失敗しました: ${error}`);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('File List Extension が有効化されました');

    // サービスクラスの初期化
    const fileOperationService = new FileOperationService();
    const explorerManager = new ExplorerManager();
    const configProvider = new ConfigurationProvider();
    const searchService = new SearchService();
    const keyboardHandler = new KeyboardShortcutHandler(explorerManager, context);
    const contextMenuManager = new ContextMenuManager(explorerManager);

    // ステータスバーアイテムを作成
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(gear) File List設定";
    statusBarItem.tooltip = "File List拡張機能のワークスペース設定";
    statusBarItem.command = "fileList.setupWorkspace";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // TreeDataProviderを作成
    const workspaceSettingsProvider = new WorkspaceSettingsProvider();
    const workspaceExplorerProvider = new WorkspaceExplorerProvider(
        fileOperationService,
        configProvider,
        searchService
    );
    const fileListProvider = new FileListProvider();
    const fileDetailsProvider = new FileDetailsProvider(fileListProvider);
    const gitChangesProvider = new GitChangesProvider();

    // プロジェクトルートを設定
    const initializeWithWorkspaceRoot = async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // 設定から相対パスを取得
        const config = vscode.workspace.getConfiguration('fileListExtension');
        const defaultRelativePath = config.get<string>('defaultRelativePath');
        
        let targetPath: string;
        
        if (defaultRelativePath && defaultRelativePath.trim()) {
            // 相対パスを絶対パスに変換
            const relativePath = defaultRelativePath.trim();
            targetPath = path.resolve(workspaceRoot, relativePath);
            
            // パスの存在確認
            try {
                const stat = fs.statSync(targetPath);
                if (!stat.isDirectory()) {
                    throw new Error('Not a directory');
                }
            } catch (error) {
                vscode.window.showWarningMessage(`設定された相対パスが無効です: ${relativePath}`);
                // フォールバックとしてワークスペースルートを使用
                targetPath = workspaceRoot;
            }
        } else {
            // ワークスペースルートを使用
            targetPath = workspaceRoot;
        }
        
        fileListProvider.setRootPath(targetPath);
        
        // ファイル一覧ペインにも同じパスを設定（パスが存在する場合のみ）
        try {
            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) {
                fileDetailsProvider.setRootPath(targetPath);
            }
        } catch (error) {
            // パスが存在しない場合はファイル一覧ペインは空のまま
        }
    };

    // ビューを登録
    const workspaceSettingsView = vscode.window.createTreeView('workspaceSettings', {
        treeDataProvider: workspaceSettingsProvider,
        showCollapseAll: false
    });

    const workspaceView = vscode.window.createTreeView('workspaceExplorer', {
        treeDataProvider: workspaceExplorerProvider,
        showCollapseAll: true,
        canSelectMany: true,
        dragAndDropController: workspaceExplorerProvider
    });

    // TreeViewをProviderに設定
    workspaceExplorerProvider.setTreeView(workspaceView);

    // アクティブエディタの変更を監視
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        workspaceExplorerProvider.updateTitle(editor);

        // ビューが表示されている場合のみ自動選択を実行
        // visible=trueはビューが表示されていることを意味する
        if (workspaceView.visible) {
            await workspaceExplorerProvider.revealActiveFile(editor);
        }
    });

    // ビューが表示されたときに現在のファイルを選択
    workspaceView.onDidChangeVisibility(async () => {
        if (workspaceView.visible && vscode.window.activeTextEditor) {
            await workspaceExplorerProvider.revealActiveFile(vscode.window.activeTextEditor);
        }
    });

    // 初期タイトルを設定
    workspaceExplorerProvider.updateTitle(vscode.window.activeTextEditor);

    // 初期ファイルの選択
    if (vscode.window.activeTextEditor) {
        setTimeout(async () => {
            await workspaceExplorerProvider.revealActiveFile(vscode.window.activeTextEditor);
        }, 500);
    }

    const treeView = vscode.window.createTreeView('fileListExplorer', {
        treeDataProvider: fileListProvider,
        showCollapseAll: true
    });

    // TreeViewをProviderに設定
    fileListProvider.setTreeView(treeView);

    const detailsView = vscode.window.createTreeView('fileListDetails', {
        treeDataProvider: fileDetailsProvider,
        showCollapseAll: true,
        canSelectMany: false,
        dragAndDropController: fileDetailsProvider
    });

    const gitChangesView = vscode.window.createTreeView('gitChanges', {
        treeDataProvider: gitChangesProvider,
        showCollapseAll: false
    });

    // FileDetailsProviderにdetailsViewの参照を渡す
    fileDetailsProvider.setTreeView(detailsView);



    // 初期化を実行
    initializeWithWorkspaceRoot();


    // 初期化後にルートフォルダを選択状態にする
    setTimeout(async () => {
        const currentRootPath = fileListProvider.getRootPath();
        if (currentRootPath) {
            await selectInitialFolder(treeView, currentRootPath);
            // ファイル一覧ペインにも同じパスを確実に設定
            fileDetailsProvider.setRootPath(currentRootPath);
        }
    }, 500);

    // フォルダ選択時に下ペインにファイル一覧を表示
    treeView.onDidChangeSelection(async (e) => {
        if (e.selection.length > 0) {
            const selectedItem = e.selection[0];
            if (selectedItem.isDirectory) {
                fileDetailsProvider.setRootPath(selectedItem.filePath);
            }
        }
    });

    // ファイル一覧ビューの選択状態を追跡（無効化）
    // 選択状態を保持しないことで、常に現在のフォルダ直下に作成される
    /*
    detailsView.onDidChangeSelection(async (e) => {
        if (e.selection.length > 0) {
            fileDetailsProvider.setSelectedItem(e.selection[0]);
        } else {
            fileDetailsProvider.setSelectedItem(undefined);
        }
    });
    */

    // ビューを有効化
    vscode.commands.executeCommand('setContext', 'fileListView:enabled', true);

    // フォルダ選択コマンドを登録
    const selectFolderCommand = vscode.commands.registerCommand('fileList.selectFolder', async () => {
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'フォルダを選択'
        });

        if (folderUri && folderUri.length > 0) {
            fileListProvider.setRootPath(folderUri[0].fsPath);
        }
    });

    // 更新コマンドを登録
    const refreshCommand = vscode.commands.registerCommand('fileList.refresh', () => {
        fileListProvider.refresh();
    });

    // 下ペイン表示コマンドを登録
    const showInPanelCommand = vscode.commands.registerCommand('fileList.showInPanel', async (item: FileItem) => {
        if (item && item.isDirectory) {
            fileDetailsProvider.setRootPath(item.filePath);
        }
    });

    // フォルダを開くコマンドを登録
    const openFolderCommand = vscode.commands.registerCommand('fileList.openFolder', async (folderPath: string) => {
        fileDetailsProvider.setRootPath(folderPath);
    });

    // 親フォルダへ移動するコマンドを登録
    const goToParentCommand = vscode.commands.registerCommand('fileList.goToParent', async () => {
        // フォルダツリーviewの親フォルダへ移動
        const currentPath = fileListProvider.getRootPath();
        if (currentPath) {
            const parentPath = path.dirname(currentPath);
            
            // プロジェクトルートより上には移動しない
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot && parentPath.startsWith(workspaceRoot) && parentPath !== currentPath) {
                fileListProvider.setRootPath(parentPath);
                // ファイル一覧ペインも同期
                fileDetailsProvider.setRootPath(parentPath);
            } else {
                vscode.window.showInformationMessage('これ以上上のフォルダはありません');
            }
        } else {
            // フォルダツリーにパスが設定されていない場合は、ファイル一覧ペインの親フォルダへ移動
            fileDetailsProvider.goToParentFolder();
        }
    });

    // フォルダ選択リセットコマンドを登録
    const resetFolderSelectionCommand = vscode.commands.registerCommand('fileList.resetFolderSelection', async () => {
        const rootPath = fileListProvider.getRootPath();

        if (!rootPath) {
            vscode.window.showInformationMessage('フォルダツリーのルートが設定されていません');
            return;
        }

        fileListProvider.resetActiveFolder();
        fileDetailsProvider.setRootPath(rootPath);

        vscode.window.showInformationMessage('フォルダ選択をリセットしました');
    });

    // 相対パス設定コマンドを登録
    const setRelativePathCommand = vscode.commands.registerCommand('fileList.setRelativePath', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const currentPath = fileListProvider.getRootPath() || workspaceRoot;
        
        // 現在のパスから相対パスを計算
        const currentRelativePath = path.relative(workspaceRoot, currentPath);
        const displayPath = currentRelativePath === '' ? '.' : currentRelativePath;

        const inputPath = await vscode.window.showInputBox({
            prompt: `ワークスペースルート (${path.basename(workspaceRoot)}) からの相対パスを入力してください`,
            value: displayPath,
            placeHolder: 'src, docs/api, .claude, . (ルート)'
        });

        if (inputPath !== undefined) {
            const trimmedPath = inputPath.trim();
            let targetPath: string;

            if (trimmedPath === '' || trimmedPath === '.') {
                // 空文字または'.'の場合はワークスペースルート
                targetPath = workspaceRoot;
            } else {
                // 相対パスを絶対パスに変換
                targetPath = path.resolve(workspaceRoot, trimmedPath);
            }
            
            // パスの存在確認（エラーでも続行）
            let pathExists = false;
            let isDirectory = false;
            
            try {
                const stat = fs.statSync(targetPath);
                pathExists = true;
                isDirectory = stat.isDirectory();
            } catch (error) {
                // パスが存在しない場合でも続行
                pathExists = false;
            }
            
            if (pathExists && !isDirectory) {
                vscode.window.showErrorMessage(`指定されたパスはディレクトリではありません: ${targetPath}`);
                return;
            }
            
            if (!pathExists) {
                const continueChoice = await vscode.window.showWarningMessage(
                    `指定されたパスが見つかりません:\n相対パス: ${trimmedPath}\n絶対パス: ${targetPath}\n\n続行しますか？`,
                    'はい',
                    'いいえ'
                );
                
                if (continueChoice !== 'はい') {
                    return;
                }
            }
            
            // パスを設定（存在しなくても設定）
            fileListProvider.setRootPath(targetPath);
            
            // ファイル一覧ペインにも同じパスを設定（存在する場合のみ）
            if (pathExists) {
                fileDetailsProvider.setRootPath(targetPath);
            }
            
            // 設定に保存するかユーザーに確認
            const relativePathToSave = trimmedPath === '' || trimmedPath === '.' ? '' : trimmedPath;
            const saveChoice = await vscode.window.showInformationMessage(
                `相対パス "${relativePathToSave || '.'}" を設定に保存しますか？`,
                'はい',
                'いいえ'
            );
            
            if (saveChoice === 'はい') {
                const config = vscode.workspace.getConfiguration('fileListExtension');
                await config.update('defaultRelativePath', relativePathToSave, vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage('設定に保存しました');
            }
            
            // 設定したフォルダを選択状態にする（存在する場合のみ）
            if (pathExists) {
                setTimeout(async () => {
                    await selectInitialFolder(treeView, targetPath);
                }, 300);
            }
        }
    });

    // 設定を開くコマンドを登録
    const openSettingsCommand = vscode.commands.registerCommand('fileList.openSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'fileListExtension');
    });

    // ワークスペース設定コマンドを登録
    const setupWorkspaceCommand = vscode.commands.registerCommand('fileList.setupWorkspace', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // 設定オプションを表示
        const options = [
            {
                label: '$(gear) settings.jsonを作成/編集',
                description: 'ワークスペース設定ファイルを作成または編集',
                action: 'settings'
            },
            {
                label: '$(file-text) テンプレートをカスタマイズ',
                description: 'ファイル作成時のテンプレートをカスタマイズ',
                action: 'template'
            },
            {
                label: '$(folder) .claudeフォルダを設定',
                description: 'defaultRelativePathを.claudeに設定',
                action: 'claude'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: '設定したい項目を選択してください'
        });

        if (!selected) {
            return;
        }

        switch (selected.action) {
            case 'settings':
                await setupSettingsJson(workspaceRoot);
                break;
            case 'template':
                await setupTemplate(workspaceRoot);
                break;
            case 'claude':
                await setupClaudeFolder(workspaceRoot);
                break;
        }
    });

    // 個別の設定コマンドを登録
    const setupSettingsCommand = vscode.commands.registerCommand('fileList.setupSettings', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        await setupSettingsJson(workspaceRoot);
    });

    const setupTemplateCommand = vscode.commands.registerCommand('fileList.setupTemplate', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        await setupTemplate(workspaceRoot);
    });

    const setupClaudeCommand = vscode.commands.registerCommand('fileList.setupClaude', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        await setupClaudeFolder(workspaceRoot);
    });

    // Gitファイルを開くコマンドを登録
    const openGitFileCommand = vscode.commands.registerCommand('fileList.openGitFile', async (item: GitFileItem) => {
        if (item && item.filePath) {
            const document = await vscode.workspace.openTextDocument(item.filePath);
            await vscode.window.showTextDocument(document);
        }
    });

    // Git差分を表示するコマンドを登録
    const showGitDiffCommand = vscode.commands.registerCommand('fileList.showGitDiff', async (item: GitFileItem) => {
        if (item && item.filePath) {
            await gitChangesProvider.showDiff(item);
        }
    });

    // Git変更を更新するコマンドを登録
    const refreshGitChangesCommand = vscode.commands.registerCommand('fileList.refreshGitChanges', () => {
        gitChangesProvider.refresh();
    });

    // markdownファイルを作成するコマンドを登録
    const createMarkdownFileCommand = vscode.commands.registerCommand('fileList.createMarkdownFile', async (item?: FileItem) => {
        let targetPath: string;

        // 優先順位に従って作成先を決定
        // 1. コンテキストメニューから呼ばれた場合（itemが渡された場合）
        if (item) {
            if (item.isDirectory) {
                targetPath = item.filePath;
            } else {
                targetPath = path.dirname(item.filePath);
            }
        }
        // 2. ファイル一覧ペインで現在開いているフォルダ（選択状態に関わらず常に使用）
        else {
            const currentPath = fileDetailsProvider.getCurrentPath();
            if (!currentPath) {
                vscode.window.showErrorMessage('ファイル一覧ペインでフォルダが開かれていません');
                return;
            }
            targetPath = currentPath;
        }

        // 現在の日時を YYYY-MM-DD-HH-MM 形式で取得
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');

        const timestamp = `${year}-${month}-${day}-${hour}-${minute}`;
        const fileName = `${timestamp}.md`;
        const filePath = path.join(targetPath, fileName);

        try {
            // テンプレートを使用してファイル内容を生成
            const variables = {
                datetime: now.toLocaleString('ja-JP'),
                filename: fileName,
                timestamp: timestamp
            };

            const content = loadTemplate(context, variables);

            // FileOperationServiceを使用してファイル作成
            const result = await fileOperationService.createFile(filePath, content);

            if (result.success) {
                // ビューを更新
                fileDetailsProvider.refresh();
                workspaceExplorerProvider.refresh();

                // 作成したファイルを開く
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);

                vscode.window.showInformationMessage(`メモファイル ${fileName} を作成しました`);
            } else {
                throw result.error || new Error('ファイルの作成に失敗しました');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`メモファイルの作成に失敗しました: ${error}`);
        }
    });

    // フォルダを作成するコマンドを登録
    const createFolderCommand = vscode.commands.registerCommand('fileList.createFolder', async (item?: FileItem) => {
        let targetPath: string;

        // 優先順位に従って作成先を決定
        // 1. コンテキストメニューから呼ばれた場合（itemが渡された場合）
        if (item) {
            if (item.isDirectory) {
                targetPath = item.filePath;
            } else {
                targetPath = path.dirname(item.filePath);
            }
        }
        // 2. ファイル一覧ペインで現在開いているフォルダ（選択状態に関わらず常に使用）
        else {
            const currentPath = fileDetailsProvider.getCurrentPath();
            if (!currentPath) {
                vscode.window.showErrorMessage('ファイル一覧ペインでフォルダが開かれていません');
                return;
            }
            targetPath = currentPath;
        }

        // フォルダ名をユーザーに入力してもらう
        const folderName = await vscode.window.showInputBox({
            prompt: '新しいフォルダの名前を入力してください',
            placeHolder: 'フォルダ名',
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'フォルダ名を入力してください';
                }
                // 不正な文字をチェック
                if (value.match(/[<>:"|?*\/\\]/)) {
                    return '使用できない文字が含まれています: < > : " | ? * / \\';
                }
                // 既存フォルダとの重複チェック
                const folderPath = path.join(targetPath, value.trim());
                if (fs.existsSync(folderPath)) {
                    return `フォルダ "${value.trim()}" は既に存在します`;
                }
                return null;
            }
        });

        if (!folderName || folderName.trim() === '') {
            return;
        }

        const trimmedFolderName = folderName.trim();
        const folderPath = path.join(targetPath, trimmedFolderName);

        try {
            // FileOperationServiceを使用してフォルダ作成
            const result = await fileOperationService.createDirectory(folderPath);

            if (result.success) {
                // ビューを更新
                fileDetailsProvider.refresh();
                fileListProvider.refresh();
                workspaceExplorerProvider.refresh();

                vscode.window.showInformationMessage(`フォルダ "${trimmedFolderName}" を作成しました`);
            } else {
                throw result.error || new Error('フォルダの作成に失敗しました');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`フォルダの作成に失敗しました: ${error}`);
        }
    });

    // リネームコマンドを登録
    const renameCommand = vscode.commands.registerCommand('fileList.rename', async (item: FileItem) => {
        if (!item) {
            vscode.window.showErrorMessage('項目が選択されていません');
            return;
        }

        const oldName = path.basename(item.filePath);
        const dirPath = path.dirname(item.filePath);

        // 新しい名前の入力を求める
        const newName = await vscode.window.showInputBox({
            prompt: '新しい名前を入力してください',
            value: oldName,
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return '名前を入力してください';
                }
                // 不正な文字をチェック
                if (value.match(/[<>:"|?*\/\\]/)) {
                    return '使用できない文字が含まれています: < > : " | ? * / \\';
                }
                // 同じ名前の場合
                if (value === oldName) {
                    return '同じ名前です';
                }
                return null;
            }
        });

        if (!newName) {
            return;
        }

        const newPath = path.join(dirPath, newName);

        try {
            // FileOperationServiceを使用してリネーム
            const result = await fileOperationService.renameFile(item.filePath, newPath);

            if (result.success) {
                // ビューを更新
                fileDetailsProvider.refresh();
                workspaceExplorerProvider.refresh();

                vscode.window.showInformationMessage(`${oldName} を ${newName} に変更しました`);
            } else {
                throw result.error || new Error('名前の変更に失敗しました');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`名前の変更に失敗しました: ${error}`);
        }
    });

    // 削除コマンドを登録
    const deleteCommand = vscode.commands.registerCommand('fileList.delete', async (item: FileItem) => {
        if (!item) {
            vscode.window.showErrorMessage('項目が選択されていません');
            return;
        }

        const itemName = path.basename(item.filePath);
        const itemType = item.isDirectory ? 'フォルダ' : 'ファイル';

        // 確認ダイアログを表示
        const answer = await vscode.window.showWarningMessage(
            `${itemType} "${itemName}" を削除してもよろしいですか？\nこの操作は元に戻せません。`,
            'はい',
            'いいえ'
        );

        if (answer !== 'はい') {
            return;
        }

        try {
            // FileOperationServiceを使用して削除
            const result = await fileOperationService.deleteFiles([item.filePath]);

            if (result[0].success) {
                // フォルダを削除した場合は選択状態を親フォルダへ移す
                let treeUpdated = false;

                if (item.isDirectory) {
                    const rootPath = fileListProvider.getRootPath();
                    if (rootPath) {
                        if (item.filePath === rootPath) {
                            fileListProvider.resetActiveFolder();
                            treeUpdated = true;
                        } else {
                            const parentPath = path.dirname(item.filePath);
                            if (parentPath && parentPath.startsWith(rootPath) && fs.existsSync(parentPath)) {
                                fileListProvider.setActiveFolder(parentPath, true);
                                treeUpdated = true;
                            } else {
                                fileListProvider.resetActiveFolder();
                                treeUpdated = true;
                            }
                        }
                    } else {
                        fileListProvider.resetActiveFolder();
                        treeUpdated = true;
                    }
                }

                if (!treeUpdated) {
                    fileListProvider.refresh();
                }

                // ビューを更新
                fileDetailsProvider.refresh();
                workspaceExplorerProvider.refresh();

                vscode.window.showInformationMessage(`${itemType} "${itemName}" を削除しました`);
            } else {
                throw result[0].error || new Error('削除に失敗しました');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`削除に失敗しました: ${error}`);
        }
    });

    // フォルダを追加コマンドを登録（フォルダツリーview用）
    const addFolderCommand = vscode.commands.registerCommand('fileList.addFolder', async (item?: FileItem) => {
        let targetPath: string;

        // コンテキストメニューから呼ばれた場合
        if (item) {
            if (item.isDirectory) {
                targetPath = item.filePath;
            } else {
                targetPath = path.dirname(item.filePath);
            }
        } else {
            // フォルダツリーviewで現在選択されているフォルダまたはルートフォルダを使用
            const currentPath = fileListProvider.getRootPath();
            if (!currentPath) {
                vscode.window.showErrorMessage('フォルダが開かれていません');
                return;
            }
            targetPath = currentPath;
        }

        // フォルダ名をユーザーに入力してもらう
        const folderName = await vscode.window.showInputBox({
            prompt: '新しいフォルダの名前を入力してください',
            placeHolder: 'フォルダ名',
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'フォルダ名を入力してください';
                }
                // 不正な文字をチェック
                if (value.match(/[<>:"|?*\/\\]/)) {
                    return '使用できない文字が含まれています: < > : " | ? * / \\';
                }
                // 既存フォルダとの重複チェック
                const folderPath = path.join(targetPath, value.trim());
                if (fs.existsSync(folderPath)) {
                    return `フォルダ "${value.trim()}" は既に存在します`;
                }
                return null;
            }
        });

        if (!folderName || folderName.trim() === '') {
            return;
        }

        const trimmedFolderName = folderName.trim();
        const folderPath = path.join(targetPath, trimmedFolderName);

        try {
            // フォルダを作成
            fs.mkdirSync(folderPath, { recursive: true });
            vscode.window.showInformationMessage(`フォルダ "${trimmedFolderName}" を作成しました`);

            // ビューを更新
            fileDetailsProvider.refresh();
            fileListProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`フォルダの作成に失敗しました: ${error}`);
        }
    });

    // フォルダ削除コマンドを登録（フォルダツリーview用）
    const deleteFolderCommand = vscode.commands.registerCommand('fileList.deleteFolder', async (item?: FileItem) => {
        if (!item || !item.isDirectory) {
            vscode.window.showErrorMessage('フォルダが選択されていません');
            return;
        }

        await vscode.commands.executeCommand('fileList.delete', item);
    });

    // 相対パスをコピーコマンドを登録
    const copyRelativePathCommand = vscode.commands.registerCommand('fileList.copyRelativePath', async (item?: FileItem) => {
        if (!item) {
            vscode.window.showErrorMessage('ファイルまたはフォルダが選択されていません');
            return;
        }

        // ワークスペースルートを取得
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // 相対パスを計算
        const relativePath = path.relative(workspaceRoot, item.filePath);

        // クリップボードにコピー
        await vscode.env.clipboard.writeText(relativePath);
        vscode.window.showInformationMessage(`相対パスをコピーしました: ${relativePath}`);
    });

    // コピーコマンドを登録(workspaceExplorer用)
    const copyCommand = vscode.commands.registerCommand('fileList.copy', async (item?: FileItem, items?: FileItem[]) => {
        // 複数選択時はitemsを優先、単一選択時はitemを使用
        const selectedItems = items && items.length > 0 ? items : (item ? [item] : []);

        if (selectedItems.length === 0) {
            vscode.window.showErrorMessage('ファイルまたはフォルダが選択されていません');
            return;
        }

        try {
            const paths = selectedItems.map(i => i.filePath);
            await explorerManager.copyToClipboard(paths);

            if (selectedItems.length === 1) {
                const itemName = path.basename(selectedItems[0].filePath);
                vscode.window.showInformationMessage(`"${itemName}" をコピーしました`);
            } else {
                vscode.window.showInformationMessage(`${selectedItems.length}個のアイテムをコピーしました`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`コピーに失敗しました: ${error}`);
        }
    });

    // 切り取りコマンドを登録(workspaceExplorer用)
    const cutCommand = vscode.commands.registerCommand('fileList.cut', async (item?: FileItem, items?: FileItem[]) => {
        // 複数選択時はitemsを優先、単一選択時はitemを使用
        const selectedItems = items && items.length > 0 ? items : (item ? [item] : []);

        if (selectedItems.length === 0) {
            vscode.window.showErrorMessage('ファイルまたはフォルダが選択されていません');
            return;
        }

        try {
            const paths = selectedItems.map(i => i.filePath);
            await explorerManager.cutToClipboard(paths);

            if (selectedItems.length === 1) {
                const itemName = path.basename(selectedItems[0].filePath);
                vscode.window.showInformationMessage(`"${itemName}" を切り取りました`);
            } else {
                vscode.window.showInformationMessage(`${selectedItems.length}個のアイテムを切り取りました`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`切り取りに失敗しました: ${error}`);
        }
    });

    // 貼り付けコマンドを登録(workspaceExplorer用)
    const pasteCommand = vscode.commands.registerCommand('fileList.paste', async (item?: FileItem) => {
        const clipboardManager = explorerManager.getClipboardManager();

        if (!clipboardManager.hasData()) {
            vscode.window.showErrorMessage('クリップボードが空です');
            return;
        }

        // ターゲットパスの決定
        let targetPath: string;
        if (item) {
            if (item.isDirectory) {
                targetPath = item.filePath;
            } else {
                targetPath = path.dirname(item.filePath);
            }
        } else {
            // アイテムが指定されていない場合はワークスペースルートを使用
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('ワークスペースが開かれていません');
                return;
            }
            targetPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        try {
            await explorerManager.pasteFromClipboard(targetPath);

            // ビューを更新
            workspaceExplorerProvider.refresh();

            vscode.window.showInformationMessage('貼り付けが完了しました');
        } catch (error) {
            vscode.window.showErrorMessage(`貼り付けに失敗しました: ${error}`);
        }
    });

    // 検索コマンド
    const searchInWorkspaceCommand = vscode.commands.registerCommand('fileList.searchInWorkspace', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // 検索パターンを入力
        const pattern = await vscode.window.showInputBox({
            prompt: '検索パターンを入力してください',
            placeHolder: '例: *.ts, test*, README.md',
            value: ''
        });

        if (!pattern) {
            return;
        }

        try {
            const results = await searchService.search(workspaceRoot, {
                pattern,
                caseSensitive: false,
                useRegex: false,
                includeHidden: configProvider.getShowHidden()
            });

            // 検索結果をフィルタリング（マッチしたもののみ）
            const matchedResults = searchService.filterResults(results, true);

            if (matchedResults.length === 0) {
                vscode.window.showInformationMessage(`"${pattern}" に一致するファイルが見つかりませんでした`);
                return;
            }

            // 結果を選択肢として表示
            const items = matchedResults.map(result => ({
                label: result.name,
                description: path.relative(workspaceRoot, path.dirname(result.path)),
                detail: result.isDirectory ? 'フォルダ' : 'ファイル',
                path: result.path,
                isDirectory: result.isDirectory
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `${matchedResults.length}件の結果`,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                // ファイルの場合は開く、フォルダの場合はエクスプローラーで表示
                if (!selected.isDirectory) {
                    const document = await vscode.workspace.openTextDocument(selected.path);
                    await vscode.window.showTextDocument(document);
                } else {
                    vscode.window.showInformationMessage(`フォルダ: ${selected.path}`);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`検索に失敗しました: ${error}`);
        }
    });

    context.subscriptions.push(selectFolderCommand, refreshCommand, showInPanelCommand, openFolderCommand, goToParentCommand, resetFolderSelectionCommand, setRelativePathCommand, openSettingsCommand, setupWorkspaceCommand, setupSettingsCommand, setupTemplateCommand, setupClaudeCommand, openGitFileCommand, showGitDiffCommand, refreshGitChangesCommand, createMarkdownFileCommand, createFolderCommand, renameCommand, deleteCommand, addFolderCommand, deleteFolderCommand, copyRelativePathCommand, copyCommand, cutCommand, pasteCommand, searchInWorkspaceCommand);

    // プロバイダーのリソースクリーンアップを登録
    context.subscriptions.push({
        dispose: () => {
            workspaceExplorerProvider.dispose();
            fileListProvider.dispose();
            fileDetailsProvider.dispose();
        }
    });
}

// 初期フォルダを選択する関数
async function selectInitialFolder(treeView: vscode.TreeView<FileItem>, rootPath: string): Promise<void> {
    try {
        // プロジェクトルートのFileItemを作成
        const rootItem = new FileItem(
            path.basename(rootPath),
            vscode.TreeItemCollapsibleState.Expanded,
            rootPath,
            true,
            0,
            new Date()
        );
        
        // ルートフォルダを選択状態にする
        await treeView.reveal(rootItem, { select: true, focus: false, expand: true });
    } catch (error) {
        console.log('初期フォルダの選択に失敗しました:', error);
    }
}

// ファイル一覧を取得する関数
async function getFileList(dirPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const stat = fs.statSync(fullPath);

            files.push({
                name: entry.name,
                path: fullPath,
                isDirectory: entry.isDirectory(),
                size: entry.isFile() ? stat.size : 0,
                modified: stat.mtime
            });
        }

        // ディレクトリを先に、その後ファイルを名前順でソート
        files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

    } catch (error) {
        throw new Error(`ディレクトリの読み取りに失敗しました: ${error}`);
    }

    return files;
}





// ディレクトリを再帰的にコピーする関数
async function copyDirectory(src: string, dest: string): Promise<void> {
    // コピー先ディレクトリを作成
    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            // サブディレクトリを再帰的にコピー
            await copyDirectory(srcPath, destPath);
        } else {
            // ファイルをコピー
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// ファイルサイズをフォーマットする関数
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ファイル情報の型定義
interface FileInfo {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modified: Date;
}

// TreeDataProvider実装（フォルダのみ表示）
class FileListProvider implements vscode.TreeDataProvider<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private rootPath: string | undefined;
    private treeView: vscode.TreeView<FileItem> | undefined;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private itemCache: Map<string, FileItem[]> = new Map();  // パスをキーとしたFileItemのキャッシュ
    private activeFolderPath: string | undefined;

    constructor() { }

    setTreeView(treeView: vscode.TreeView<FileItem>): void {
        this.treeView = treeView;
    }

    setRootPath(path: string): void {
        this.rootPath = path;
        this.activeFolderPath = path;
        this.updateTitle();
        this.setupFileWatcher();
        this.refresh();
    }

    private setupFileWatcher(): void {
        // 既存のウォッチャーを破棄
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }

        // 新しいウォッチャーを設定（現在のパス配下を監視）
        if (this.rootPath) {
            const watchPattern = new vscode.RelativePattern(this.rootPath, '**/*');
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(watchPattern);

            // ファイル・フォルダの変更を監視して自動更新
            this.fileWatcher.onDidChange(() => {
                this.refresh();
            });

            this.fileWatcher.onDidCreate(() => {
                this.refresh();
            });

            this.fileWatcher.onDidDelete(() => {
                this.refresh();
            });
        }
    }

    dispose(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }
    }

    private updateTitle(): void {
        if (this.treeView && this.rootPath) {
            const folderName = path.basename(this.rootPath);
            this.treeView.title = `フォルダツリー - ${folderName}`;
        }
    }

    getRootPath(): string | undefined {
        return this.rootPath;
    }

    refresh(): void {
        this.itemCache.clear();  // キャッシュをクリア
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        if (!this.rootPath) {
            return Promise.resolve([]);
        }

        const targetPath = element ? element.resourceUri!.fsPath : this.rootPath;

        // キャッシュに存在する場合は返す
        if (this.itemCache.has(targetPath)) {
            return Promise.resolve(this.itemCache.get(targetPath)!);
        }

        try {
            const files = this.getFilesInDirectory(targetPath);
            const items = files.map(file => {
                const isDirectory = file.isDirectory;
                const collapsibleState = isDirectory
                    ? vscode.TreeItemCollapsibleState.Collapsed
                    : vscode.TreeItemCollapsibleState.None;
                const item = new FileItem(
                    file.name,
                    collapsibleState,
                    file.path,
                    isDirectory,
                    file.size,
                    file.modified
                );

                if (isDirectory && this.activeFolderPath === file.path) {
                    item.description = '選択中';
                    item.tooltip = `${item.tooltip}\n現在のフォルダです`;
                }

                return item;
            });

            // キャッシュに保存
            this.itemCache.set(targetPath, items);
            return Promise.resolve(items);
        } catch (error) {
            vscode.window.showErrorMessage(`ディレクトリの読み取りに失敗しました: ${error}`);
            return Promise.resolve([]);
        }
    }

    setActiveFolder(path: string | undefined, force: boolean = false): void {
        if (path && this.rootPath && !path.startsWith(this.rootPath)) {
            return;
        }

        if (!force && this.activeFolderPath === path) {
            return;
        }

        this.activeFolderPath = path;
        this.refresh();
        void this.revealActiveFolder();
    }

    async getParent(element: FileItem): Promise<FileItem | undefined> {
        if (!element || !element.isDirectory || !this.rootPath) {
            return undefined;
        }

        const parentPath = path.dirname(element.filePath);

        if (!parentPath || parentPath === element.filePath || parentPath === this.rootPath) {
            return undefined;
        }

        if (!parentPath.startsWith(this.rootPath)) {
            return undefined;
        }

        try {
            const stat = fs.statSync(parentPath);
            return new FileItem(
                path.basename(parentPath),
                vscode.TreeItemCollapsibleState.Collapsed,
                parentPath,
                true,
                0,
                stat.mtime
            );
        } catch (error) {
            console.error('親フォルダの取得に失敗しました:', error);
            return undefined;
        }
    }

    private async revealActiveFolder(): Promise<void> {
        if (!this.treeView || !this.activeFolderPath) {
            return;
        }

        try {
            const stat = fs.statSync(this.activeFolderPath);
            const item = new FileItem(
                path.basename(this.activeFolderPath),
                this.activeFolderPath === this.rootPath
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.Collapsed,
                this.activeFolderPath,
                stat.isDirectory(),
                stat.isDirectory() ? 0 : stat.size,
                stat.mtime
            );

            await this.treeView.reveal(item, { select: true, focus: false, expand: true });
        } catch (error) {
            console.error('フォルダ選択の表示に失敗しました:', error);
        }
    }

    resetActiveFolder(): void {
        if (!this.rootPath) {
            this.setActiveFolder(undefined, true);
            return;
        }

        this.setActiveFolder(this.rootPath, true);
    }

    private getFilesInDirectory(dirPath: string): FileInfo[] {
        const files: FileInfo[] = [];

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                // フォルダツリーペインではディレクトリのみを表示
                if (entry.isDirectory()) {
                    const fullPath = path.join(dirPath, entry.name);
                    const stat = fs.statSync(fullPath);

                    files.push({
                        name: entry.name,
                        path: fullPath,
                        isDirectory: true,
                        size: 0,
                        modified: stat.mtime
                    });
                }
            }

            // ディレクトリを名前順でソート
            files.sort((a, b) => a.name.localeCompare(b.name));

        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err && err.code === 'ENOENT') {
                return [];
            }

            const message = err && err.message ? err.message : String(error);
            throw new Error(`ディレクトリの読み取りに失敗しました: ${message}`);
        }

        return files;
    }


}

// ファイル詳細用TreeDataProvider実装（フォルダツリーと同じ機能）
class FileDetailsProvider implements vscode.TreeDataProvider<FileItem>, vscode.TreeDragAndDropController<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private rootPath: string | undefined;
    private projectRootPath: string | undefined;
    private treeView: vscode.TreeView<FileItem> | undefined;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private selectedItem: FileItem | undefined;
    private itemCache: Map<string, FileItem[]> = new Map();  // パスをキーとしたFileItemのキャッシュ

    constructor(private readonly folderTreeProvider: FileListProvider) {
        // プロジェクトルートパスを取得
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.projectRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
    }

    setTreeView(treeView: vscode.TreeView<FileItem>): void {
        this.treeView = treeView;
    }

    setFiles(dirPath: string, files: FileInfo[]): void {
        this.rootPath = dirPath;
        this.updateTitle();
        this.refresh();
        this.folderTreeProvider.setActiveFolder(dirPath);
    }

    setRootPath(path: string): void {
        this.rootPath = path;
        this.updateTitle();
        this.setupFileWatcher();
        this.refresh();
        this.folderTreeProvider.setActiveFolder(path);
    }

    private updateTitle(): void {
        if (this.treeView && this.rootPath) {
            const folderName = path.basename(this.rootPath);
            this.treeView.title = `markdown一覧 - ${folderName}`;
        }
    }

    goToParentFolder(): void {
        if (!this.rootPath) {
            return;
        }

        // 現在のパスがルートディレクトリかどうかをチェック
        if (path.dirname(this.rootPath) === this.rootPath) {
            vscode.window.showInformationMessage('これ以上上のフォルダはありません');
            return;
        }

        const parentPath = path.dirname(this.rootPath);

        // プロジェクトルートより上には移動しない
        if (this.projectRootPath && !parentPath.startsWith(this.projectRootPath)) {
            vscode.window.showInformationMessage('プロジェクトルートより上には移動できません');
            return;
        }

        this.setRootPath(parentPath);
    }

    getCurrentPath(): string | undefined {
        return this.rootPath;
    }

    setSelectedItem(item: FileItem | undefined): void {
        this.selectedItem = item;
    }

    getSelectedItem(): FileItem | undefined {
        return this.selectedItem;
    }

    private setupFileWatcher(): void {
        // 既存のウォッチャーを破棄
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }

        // 新しいウォッチャーを設定（現在のパス配下を監視）
        if (this.rootPath) {
            const watchPattern = new vscode.RelativePattern(this.rootPath, '**/*');
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(watchPattern);

            // ファイル・フォルダの変更を監視して自動更新
            this.fileWatcher.onDidChange(() => {
                this.refresh();
            });

            this.fileWatcher.onDidCreate(() => {
                this.refresh();
            });

            this.fileWatcher.onDidDelete(() => {
                this.refresh();
            });
        }
    }

    dispose(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }
    }

    refresh(): void {
        this.itemCache.clear();  // キャッシュをクリア
        this._onDidChangeTreeData.fire();
    }

    private getRelativePath(fullPath: string): string {
        if (!this.projectRootPath) {
            return fullPath;
        }

        const relativePath = path.relative(this.projectRootPath, fullPath);
        return relativePath || '.'; // ルートの場合は '.' を返す
    }

    // ドラッグ&ドロップのサポート
    readonly dragMimeTypes = ['application/vnd.code.tree.fileListDetails'];
    readonly dropMimeTypes = ['application/vnd.code.tree.fileListDetails', 'text/uri-list'];

    handleDrag(source: readonly FileItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        dataTransfer.set('application/vnd.code.tree.fileListDetails', new vscode.DataTransferItem(source));
    }

    handleDrop(target: FileItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        const transferItem = dataTransfer.get('application/vnd.code.tree.fileListDetails');
        if (!transferItem) {
            return;
        }

        const sourceItems = transferItem.value as readonly FileItem[];
        if (!sourceItems || sourceItems.length === 0) {
            return;
        }

        // ターゲットディレクトリの決定
        let targetDir: string;
        if (!target) {
            // ビューのルートにドロップされた場合
            targetDir = this.rootPath!;
        } else if (target.isDirectory) {
            // フォルダにドロップされた場合
            targetDir = target.filePath;
        } else {
            // ファイルにドロップされた場合は、その親ディレクトリに移動
            targetDir = path.dirname(target.filePath);
        }

        // ファイルの移動処理
        this.moveFiles(sourceItems, targetDir);
    }

    private async moveFiles(sourceItems: readonly FileItem[], targetDir: string): Promise<void> {
        for (const item of sourceItems) {
            const sourcePath = item.filePath;
            const fileName = path.basename(sourcePath);
            const targetPath = path.join(targetDir, fileName);

            // 同じディレクトリへの移動は無視
            if (path.dirname(sourcePath) === targetDir) {
                continue;
            }

            try {
                // ファイルが既に存在するかチェック
                if (fs.existsSync(targetPath)) {
                    const answer = await vscode.window.showWarningMessage(
                        `${fileName} は既に存在します。上書きしますか？`,
                        '上書き',
                        'スキップ'
                    );
                    if (answer !== '上書き') {
                        continue;
                    }
                }

                // ファイル/フォルダを移動
                fs.renameSync(sourcePath, targetPath);
            } catch (error) {
                vscode.window.showErrorMessage(`${fileName} の移動に失敗しました: ${error}`);
            }
        }

        // ビューを更新
        this.refresh();
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        if (!this.rootPath) {
            // フォルダが選択されるまで何も表示しない
            return Promise.resolve([]);
        }

        const targetPath = element ? element.resourceUri!.fsPath : this.rootPath;

        // キャッシュに存在する場合は返す
        if (this.itemCache.has(targetPath)) {
            return Promise.resolve(this.itemCache.get(targetPath)!);
        }

        try {
            const files = this.getFilesInDirectory(targetPath);
            const fileItems = files.map(file => new FileItem(
                file.name,
                file.isDirectory ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
                file.path,
                file.isDirectory,
                file.size,
                file.modified
            ));

            // キャッシュに保存
            this.itemCache.set(targetPath, fileItems);
            return Promise.resolve(fileItems);
        } catch (error) {
            vscode.window.showErrorMessage(`ディレクトリの読み取りに失敗しました: ${error}`);
            return Promise.resolve([]);
        }
    }

    private getFilesInDirectory(dirPath: string): FileInfo[] {
        const files: FileInfo[] = [];

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                // フォルダを除外し、ファイルのみを対象にする
                if (entry.isDirectory()) {
                    continue;
                }

                const fullPath = path.join(dirPath, entry.name);
                const stat = fs.statSync(fullPath);

                // シンボリックリンクなどで実体がフォルダの場合も除外
                if (stat.isDirectory()) {
                    continue;
                }

                // mdファイルのみを表示対象にする
                if (path.extname(entry.name).toLowerCase() !== '.md') {
                    continue;
                }

                files.push({
                    name: entry.name,
                    path: fullPath,
                    isDirectory: false,
                    size: stat.size,
                    modified: stat.mtime
                });
            }

            // ファイルのみなので名前順でソート
            files.sort((a, b) => a.name.localeCompare(b.name));

        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err && err.code === 'ENOENT') {
                return [];
            }

            const message = err && err.message ? err.message : String(error);
            throw new Error(`ディレクトリの読み取りに失敗しました: ${message}`);
        }

        return files;
    }
}



// TreeItem実装
class FileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly filePath: string,
        public readonly isDirectory: boolean,
        public readonly size: number,
        public readonly modified: Date,
        showFileIcons: boolean = true
    ) {
        super(label, collapsibleState);

        this.resourceUri = vscode.Uri.file(filePath);
        this.id = filePath;
        this.contextValue = isDirectory ? 'directory' : 'file';

        // アイコンを設定（設定が有効な場合のみ）
        if (showFileIcons && this.contextValue !== 'header') {
            if (isDirectory) {
                this.iconPath = new vscode.ThemeIcon('folder');
            } else {
                // ファイル種類に応じたアイコンを設定
                this.iconPath = this.getFileIcon(label);
            }
        }

        // ツールチップを設定
        const sizeText = isDirectory ? 'ディレクトリ' : formatFileSize(size);
        this.tooltip = `${label}\n種類: ${sizeText}\n更新日時: ${modified.toLocaleString('ja-JP')}`;

        // ファイルの場合はクリックで開く
        if (!isDirectory) {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [this.resourceUri]
            };
        }
    }

    /**
     * ファイル種類に応じたアイコンを取得
     */
    private getFileIcon(fileName: string): vscode.ThemeIcon {
        const ext = path.extname(fileName).toLowerCase();

        // 拡張子に応じてアイコンを選択
        const iconMap: { [key: string]: string } = {
            '.ts': 'symbol-method',
            '.tsx': 'symbol-method',
            '.js': 'symbol-function',
            '.jsx': 'symbol-function',
            '.json': 'json',
            '.md': 'markdown',
            '.txt': 'file-text',
            '.py': 'symbol-class',
            '.java': 'symbol-class',
            '.cpp': 'symbol-class',
            '.c': 'symbol-class',
            '.h': 'symbol-class',
            '.css': 'symbol-color',
            '.scss': 'symbol-color',
            '.html': 'symbol-misc',
            '.xml': 'symbol-misc',
            '.yml': 'settings-gear',
            '.yaml': 'settings-gear',
            '.sh': 'terminal',
            '.bat': 'terminal',
            '.png': 'file-media',
            '.jpg': 'file-media',
            '.jpeg': 'file-media',
            '.gif': 'file-media',
            '.svg': 'file-media',
            '.pdf': 'file-pdf',
            '.zip': 'file-zip',
            '.git': 'git-branch',
            '.gitignore': 'git-branch'
        };

        return new vscode.ThemeIcon(iconMap[ext] || 'file');
    }
}

// Git変更ファイル用TreeDataProvider実装
class GitChangesProvider implements vscode.TreeDataProvider<GitFileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<GitFileItem | undefined | null | void> = new vscode.EventEmitter<GitFileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<GitFileItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private refreshDebounceTimer: NodeJS.Timeout | undefined;
    private isGitOperationInProgress: boolean = false;
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    constructor() {
        // ファイルシステムの変更を監視（.gitディレクトリとnode_modulesは除外）
        // globパターンで除外設定を明示的に指定
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(
                vscode.workspace.workspaceFolders?.[0] || '',
                '**/{[!.],.[!g],.[g][!i],.[gi][!t]}*'  // .gitで始まるものを除外
            ),
            false,  // create
            false,  // change
            false   // delete
        );

        // デバウンス処理付きでrefreshを呼び出す
        this.fileWatcher.onDidChange((uri) => {
            // .gitディレクトリ内のファイルは無視
            if (!uri.fsPath.includes('.git')) {
                this.debouncedRefresh();
            }
        });
        this.fileWatcher.onDidCreate((uri) => {
            if (!uri.fsPath.includes('.git')) {
                this.debouncedRefresh();
            }
        });
        this.fileWatcher.onDidDelete((uri) => {
            if (!uri.fsPath.includes('.git')) {
                this.debouncedRefresh();
            }
        });
    }

    private debouncedRefresh(): void {
        // 既存のタイマーをクリア
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        // 1000ms後に実行（連続した変更をまとめ、git操作との競合を回避）
        this.refreshDebounceTimer = setTimeout(() => {
            this.refresh();
        }, 1000);
    }

    refresh(): void {
        // git操作中の場合はスキップ
        if (this.isGitOperationInProgress) {
            console.log('Git operation in progress, skipping refresh');
            return;
        }
        this._onDidChangeTreeData.fire();
    }

    dispose(): void {
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
    }

    async showDiff(item: GitFileItem): Promise<void> {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        try {
            if (item.status === 'Untracked') {
                // 新規ファイルの場合は空ファイルとの差分を表示
                await this.showUntrackedFileDiff(item.relativePath, item.filePath);
                return;
            }

            if (item.status === 'Deleted') {
                // 削除されたファイルの場合はHEADバージョンと空ファイルの差分を表示
                await this.showDeletedFileDiff(workspaceRoot, item.relativePath);
                return;
            }

            // 通常の変更ファイルの差分を表示
            await this.showFileDiff(workspaceRoot, item.relativePath, item.filePath);
            
        } catch (error) {
            vscode.window.showErrorMessage(`差分の表示に失敗しました: ${error}`);
        }
    }

    private async showFileDiff(workspaceRoot: string, relativePath: string, filePath: string): Promise<void> {
        // Git操作開始をマーク
        this.isGitOperationInProgress = true;

        return new Promise((resolve, reject) => {
            // HEADバージョンの内容を取得
            exec(`git show HEAD:"${relativePath}"`, { cwd: workspaceRoot }, async (error, stdout, stderr) => {
                // Git操作終了をマーク
                this.isGitOperationInProgress = false;
                if (error) {
                    // HEADにファイルが存在しない場合（新規追加）は空ファイルとの差分を表示
                    await this.showUntrackedFileDiff(relativePath, filePath);
                    resolve();
                    return;
                }

                try {
                    // 一時的なHEADバージョンのURIを作成
                    const headUri = vscode.Uri.parse(`git-head:${relativePath}?${Date.now()}`);
                    const currentUri = vscode.Uri.file(filePath);

                    // カスタムテキストドキュメントプロバイダーを登録
                    const provider = new GitHeadContentProvider(stdout);
                    const registration = vscode.workspace.registerTextDocumentContentProvider('git-head', provider);

                    // 差分を表示
                    await vscode.commands.executeCommand('vscode.diff', 
                        headUri, 
                        currentUri, 
                        `${path.basename(relativePath)} (HEAD ↔ Working Tree)`
                    );

                    // 一定時間後にプロバイダーを削除
                    setTimeout(() => registration.dispose(), 30000);
                    
                    resolve();
                } catch (diffError) {
                    reject(diffError);
                }
            });
        });
    }

    private async showDeletedFileDiff(workspaceRoot: string, relativePath: string): Promise<void> {
        // Git操作開始をマーク
        this.isGitOperationInProgress = true;

        return new Promise((resolve, reject) => {
            exec(`git show HEAD:"${relativePath}"`, { cwd: workspaceRoot }, async (error, stdout, stderr) => {
                // Git操作終了をマーク
                this.isGitOperationInProgress = false;
                if (error) {
                    reject(error);
                    return;
                }

                try {
                    // 削除されたファイルのHEADバージョンを表示
                    const headUri = vscode.Uri.parse(`git-head-deleted:${relativePath}?${Date.now()}`);
                    const emptyUri = vscode.Uri.parse(`git-empty:${relativePath}?${Date.now()}`);

                    const headProvider = new GitHeadContentProvider(stdout);
                    const emptyProvider = new GitHeadContentProvider('');
                    
                    const headRegistration = vscode.workspace.registerTextDocumentContentProvider('git-head-deleted', headProvider);
                    const emptyRegistration = vscode.workspace.registerTextDocumentContentProvider('git-empty', emptyProvider);

                    await vscode.commands.executeCommand('vscode.diff', 
                        headUri, 
                        emptyUri, 
                        `${path.basename(relativePath)} (HEAD ↔ Deleted)`
                    );

                    setTimeout(() => {
                        headRegistration.dispose();
                        emptyRegistration.dispose();
                    }, 30000);
                    
                    resolve();
                } catch (diffError) {
                    reject(diffError);
                }
            });
        });
    }

    private async showUntrackedFileDiff(relativePath: string, filePath: string): Promise<void> {
        try {
            // 新規ファイルの場合は空ファイルと現在のファイルの差分を表示
            const emptyUri = vscode.Uri.parse(`git-empty-untracked:${relativePath}?${Date.now()}`);
            const currentUri = vscode.Uri.file(filePath);

            const emptyProvider = new GitHeadContentProvider('');
            const emptyRegistration = vscode.workspace.registerTextDocumentContentProvider('git-empty-untracked', emptyProvider);

            await vscode.commands.executeCommand('vscode.diff', 
                emptyUri, 
                currentUri, 
                `${path.basename(relativePath)} (Empty ↔ Working Tree)`
            );

            setTimeout(() => {
                emptyRegistration.dispose();
            }, 30000);
            
        } catch (error) {
            // 差分表示に失敗した場合は通常のファイルを開く
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
        }
    }

    getTreeItem(element: GitFileItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: GitFileItem): Promise<GitFileItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // 特定のGitFileItemの展開の場合（ディレクトリの場合）
        if (element && element.isDirectory) {
            try {
                const files = await this.getFilesInDirectory(element.filePath);
                return files.map(file => new GitFileItem(
                    file.name,
                    file.path,
                    'File in changed directory',
                    file.relativePath,
                    file.isDirectory
                ));
            } catch (error) {
                console.log('ディレクトリ内ファイルの取得に失敗しました:', error);
                return [];
            }
        }

        // ルートレベルの場合、Git変更を取得
        try {
            const gitChanges = await this.getGitChanges(workspaceRoot);

            return gitChanges.map(change => new GitFileItem(
                path.basename(change.path),
                change.path,
                change.status,
                change.relativePath,
                change.isDirectory
            ));
        } catch (error) {
            console.log('Git変更の取得に失敗しました:', error);
            return [];
        }
    }

    private async getGitChanges(workspaceRoot: string): Promise<GitChange[]> {
        // Git操作開始をマーク
        this.isGitOperationInProgress = true;

        return new Promise((resolve, reject) => {

            // git statusコマンドでポーセリン形式で変更ファイルを取得
            exec('git status --porcelain=v1', { cwd: workspaceRoot }, (error: any, stdout: string, stderr: string) => {
                // Git操作終了をマーク
                this.isGitOperationInProgress = false;

                if (error) {
                    resolve([]); // Gitリポジトリでない場合は空配列を返す
                    return;
                }

                console.log('Git status output:', JSON.stringify(stdout));
                
                const changes: GitChange[] = [];
                const lines = stdout.trim().split('\n').filter(line => line.length > 0);

                for (const line of lines) {
                    console.log('Processing git status line:', JSON.stringify(line));
                    
                    // git status --porcelain の形式: XY filename
                    // X: インデックスの状態, Y: ワーキングツリーの状態
                    const match = line.match(/^(..)(.*)$/);
                    if (match) {
                        const status = match[1];
                        let relativePath = match[2];
                        
                        console.log('Regex match - Status:', JSON.stringify(status), 'Path part:', JSON.stringify(relativePath));
                        
                        // 先頭のスペースを除去
                        relativePath = relativePath.replace(/^\s+/, '');
                        
                        console.log('After space removal:', JSON.stringify(relativePath));
                        
                        // 引用符で囲まれている場合は除去
                        if (relativePath.startsWith('"') && relativePath.endsWith('"')) {
                            relativePath = relativePath.slice(1, -1);
                            // エスケープされた文字を処理
                            relativePath = relativePath.replace(/\\(.)/g, '$1');
                            console.log('After quote removal:', JSON.stringify(relativePath));
                        }
                        
                        // 改行文字やその他の制御文字を除去
                        relativePath = relativePath.trim();
                        
                        if (relativePath) {
                            const fullPath = path.join(workspaceRoot, relativePath);

                            console.log('Final - Status:', JSON.stringify(status), 'RelativePath:', JSON.stringify(relativePath));
                            console.log('FullPath:', JSON.stringify(fullPath));
                            console.log('Basename:', JSON.stringify(path.basename(fullPath)));

                            // ファイル/ディレクトリの存在確認
                            let isDirectory = false;
                            try {
                                const stat = fs.statSync(fullPath);
                                isDirectory = stat.isDirectory();
                            } catch (error) {
                                // ファイルが削除されている場合は、パスから推測
                                isDirectory = false;
                            }

                            changes.push({
                                path: fullPath,
                                relativePath: relativePath,
                                status: this.parseGitStatus(status),
                                isDirectory: isDirectory
                            });
                        }
                    }
                }

                resolve(changes);
            });
        });
    }

    private parseGitStatus(status: string): string {
        const indexStatus = status[0];
        const workingStatus = status[1];

        if (indexStatus === 'A') return 'Added';
        if (indexStatus === 'M') return 'Modified';
        if (indexStatus === 'D') return 'Deleted';
        if (indexStatus === 'R') return 'Renamed';
        if (indexStatus === 'C') return 'Copied';
        if (workingStatus === 'M') return 'Modified';
        if (workingStatus === 'D') return 'Deleted';
        if (status === '??') return 'Untracked';
        
        return 'Changed';
    }

    private async getFilesInDirectory(dirPath: string): Promise<{name: string, path: string, relativePath: string, isDirectory: boolean}[]> {
        const files: {name: string, path: string, relativePath: string, isDirectory: boolean}[] = [];

        if (!vscode.workspace.workspaceFolders) {
            return files;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const relativePath = path.relative(workspaceRoot, fullPath);

                files.push({
                    name: entry.name,
                    path: fullPath,
                    relativePath: relativePath,
                    isDirectory: entry.isDirectory()
                });
            }

            // ディレクトリを先に、その後ファイルを名前順でソート
            files.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });

        } catch (error) {
            console.log('ディレクトリの読み取りに失敗しました:', error);
        }

        return files;
    }
}

// Git変更ファイル用TreeItem実装
class GitFileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string,
        public readonly status: string,
        public readonly relativePath: string,
        public readonly isDirectory: boolean = false
    ) {
        super(label, isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        
        this.resourceUri = vscode.Uri.file(filePath);
        this.contextValue = isDirectory ? 'gitDirectory' : 'gitFile';

        // ステータスに応じたアイコンを設定
        this.iconPath = this.getStatusIcon(status, isDirectory);

        // 説明にステータスと相対パスを表示
        this.description = `${status} • ${relativePath}`;

        // ツールチップを設定
        this.tooltip = `${relativePath}\nStatus: ${status}${isDirectory ? '\nType: Directory' : ''}`;

        // ディレクトリでない場合のみクリックで差分を表示
        if (!isDirectory) {
            this.command = {
                command: 'fileList.showGitDiff',
                title: 'Show Git Diff',
                arguments: [this]
            };
        }
    }

    private getStatusIcon(status: string, isDirectory: boolean = false): vscode.ThemeIcon {
        if (isDirectory) {
            switch (status) {
                case 'Added':
                    return new vscode.ThemeIcon('folder', new vscode.ThemeColor('gitDecoration.addedResourceForeground'));
                case 'Modified':
                    return new vscode.ThemeIcon('folder', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'));
                case 'Deleted':
                    return new vscode.ThemeIcon('folder', new vscode.ThemeColor('gitDecoration.deletedResourceForeground'));
                case 'Untracked':
                    return new vscode.ThemeIcon('folder', new vscode.ThemeColor('gitDecoration.untrackedResourceForeground'));
                default:
                    return new vscode.ThemeIcon('folder');
            }
        }

        switch (status) {
            case 'Added':
                return new vscode.ThemeIcon('diff-added');
            case 'Modified':
                return new vscode.ThemeIcon('diff-modified');
            case 'Deleted':
                return new vscode.ThemeIcon('diff-removed');
            case 'Untracked':
                return new vscode.ThemeIcon('question');
            case 'Renamed':
                return new vscode.ThemeIcon('diff-renamed');
            case 'File in changed directory':
                return new vscode.ThemeIcon('file');
            default:
                return new vscode.ThemeIcon('file');
        }
    }
}

// Git変更情報の型定義
interface GitChange {
    path: string;
    relativePath: string;
    status: string;
    isDirectory: boolean;
}

// ワークスペースエクスプローラープロバイダー
class WorkspaceExplorerProvider implements vscode.TreeDataProvider<FileItem>, vscode.TreeDragAndDropController<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private treeView: vscode.TreeView<FileItem> | undefined;
    private itemCache: Map<string, FileItem> = new Map();  // パスをキーとしたFileItemのキャッシュ
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    // サービスクラス
    private dragDropHandler: DragDropHandler<FileItem>;
    private multiSelectionManager: MultiSelectionManager;
    private configurationProvider: ConfigurationProvider;
    private searchService: SearchService;

    // ドラッグ&ドロップのMIMEタイプ
    readonly dropMimeTypes = ['application/vnd.code.tree.fileItem', 'text/uri-list'];
    readonly dragMimeTypes = ['application/vnd.code.tree.fileItem'];

    constructor(
        private fileOperationService: FileOperationService,
        configurationProvider: ConfigurationProvider,
        searchService: SearchService
    ) {
        this.configurationProvider = configurationProvider;
        this.searchService = searchService;
        this.dragDropHandler = new DragDropHandler(fileOperationService);
        this.multiSelectionManager = new MultiSelectionManager();
        this.setupFileWatcher();
        this.setupConfigurationWatcher();
    }

    /**
     * 設定変更を監視
     */
    private setupConfigurationWatcher(): void {
        this.configurationProvider.onConfigurationChanged((e) => {
            // 表示に影響する設定が変更された場合は更新
            if (e.affectsConfiguration('fileListExtension.sortBy') ||
                e.affectsConfiguration('fileListExtension.sortOrder') ||
                e.affectsConfiguration('fileListExtension.showFileIcons')) {
                this.refresh();
            }

            // autoRefresh設定が変更された場合はファイルウォッチャーを再設定
            if (e.affectsConfiguration('fileListExtension.autoRefresh')) {
                this.setupFileWatcher();
            }
        });
    }

    /**
     * ドラッグ開始処理
     */
    handleDrag(
        source: readonly FileItem[],
        dataTransfer: vscode.DataTransfer,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        this.dragDropHandler.handleDrag(source, dataTransfer, token);
    }

    /**
     * ドロップ処理
     */
    async handleDrop(
        target: FileItem | undefined,
        dataTransfer: vscode.DataTransfer,
        token: vscode.CancellationToken
    ): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        await this.dragDropHandler.handleDrop(
            target,
            dataTransfer,
            token,
            (item: FileItem) => item.filePath,
            (item: FileItem) => item.isDirectory,
            workspaceRoot
        );

        // ドロップ後にツリーを更新
        this.refresh();
    }

    setTreeView(treeView: vscode.TreeView<FileItem>): void {
        this.treeView = treeView;
    }

    updateTitle(editor: vscode.TextEditor | undefined): void {
        if (this.treeView) {
            if (editor) {
                const fileName = path.basename(editor.document.fileName);
                this.treeView.title = `エクスプローラー - ${fileName}`;
            } else {
                this.treeView.title = `エクスプローラー`;
            }
        }
    }

    async revealActiveFile(editor: vscode.TextEditor | undefined): Promise<void> {
        if (!this.treeView || !editor) {
            return;
        }

        const filePath = editor.document.fileName;

        // ワークスペース内のファイルかチェック
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // ファイルがワークスペース内にあることを確認
        if (!filePath.startsWith(workspaceRoot)) {
            return;
        }

        try {
            // ファイルに対応するFileItemを取得または作成
            const fileItem = await this.findOrCreateFileItem(filePath);

            if (fileItem) {
                try {
                    // ファイルを表示して選択（親フォルダも自動展開される）
                    // focus: falseでTreeViewにフォーカスを移さない
                    await this.treeView.reveal(fileItem, {
                        select: true,      // アイテムを選択状態にする
                        focus: false,      // TreeViewにフォーカスを移さない（エディタのフォーカスを保持）
                        expand: 1          // 最小限の展開のみ行う
                    });
                } catch (revealError) {
                    // reveal中のエラーは無視（フォーカスを奪わないための保護）
                    console.log('Reveal failed gracefully:', revealError);
                }
            }
        } catch (error) {
            console.log('ファイルの選択に失敗しました:', error);
        }
    }

    private async findOrCreateFileItem(filePath: string): Promise<FileItem | undefined> {
        // キャッシュから検索
        if (this.itemCache.has(filePath)) {
            return this.itemCache.get(filePath);
        }

        // パスの各階層を構築
        const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const relativePath = path.relative(workspaceRoot, filePath);
        const pathParts = relativePath.split(path.sep);

        let currentPath = workspaceRoot;
        let parentItem: FileItem | undefined;

        // ルートから順番に各階層のアイテムを取得または作成
        for (let i = 0; i <= pathParts.length; i++) {
            if (i === 0) {
                // ルートアイテムを取得
                const children = await this.getChildren();
                if (children.length > 0) {
                    parentItem = children[0];
                    this.itemCache.set(currentPath, parentItem);
                }
            } else {
                const part = pathParts[i - 1];
                currentPath = path.join(currentPath, part);

                // 既にキャッシュにある場合はそれを使用
                if (this.itemCache.has(currentPath)) {
                    parentItem = this.itemCache.get(currentPath);
                } else if (parentItem) {
                    // 親要素の子要素を取得
                    const children = await this.getChildren(parentItem);
                    const childItem = children.find(child => child.filePath === currentPath);
                    if (childItem) {
                        this.itemCache.set(currentPath, childItem);
                        parentItem = childItem;
                    }
                }
            }
        }

        return this.itemCache.get(filePath);
    }

    refresh(): void {
        this.itemCache.clear();  // キャッシュをクリア
        this._onDidChangeTreeData.fire();
    }

    private setupFileWatcher(): void {
        // 既存のウォッチャーを破棄
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }

        // autoRefresh設定が無効の場合は監視しない
        if (!this.configurationProvider.getAutoRefresh()) {
            return;
        }

        // ワークスペースフォルダがある場合のみ監視
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const watchPattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '**/*');
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(watchPattern);

            // ファイル・フォルダの変更を監視して自動更新
            this.fileWatcher.onDidChange(() => {
                this.refresh();
            });

            this.fileWatcher.onDidCreate(() => {
                this.refresh();
            });

            this.fileWatcher.onDidDelete(() => {
                this.refresh();
            });
        }
    }

    dispose(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    // 親要素を取得するメソッド（TreeViewのreveal機能に必要）
    getParent(element: FileItem): vscode.ProviderResult<FileItem> {
        const elementPath = element.filePath;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

        if (!workspaceRoot || elementPath === workspaceRoot) {
            // ルート要素の場合は親なし
            return undefined;
        }

        const parentPath = path.dirname(elementPath);

        // 親がワークスペースルートの場合
        if (parentPath === workspaceRoot) {
            // ルートアイテムを返す（キャッシュから取得）
            return this.itemCache.get(workspaceRoot) || undefined;
        }

        // キャッシュから親要素を取得
        return this.itemCache.get(parentPath) || undefined;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return Promise.resolve([]);
        }

        // ルート要素の場合、ワークスペースフォルダのルートを返す
        if (!element) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const rootName = path.basename(workspaceRoot);
            const showFileIcons = this.configurationProvider.getShowFileIcons();
            const rootItem = new FileItem(
                rootName,
                vscode.TreeItemCollapsibleState.Expanded,
                workspaceRoot,
                true,
                0,
                new Date(),
                showFileIcons
            );
            // ルートアイテムをキャッシュに保存
            this.itemCache.set(workspaceRoot, rootItem);
            return Promise.resolve([rootItem]);
        }

        // 選択された要素のサブアイテムを返す
        const targetPath = element.resourceUri!.fsPath;
        return this.getFileItems(targetPath);
    }

    private async getFileItems(dirPath: string): Promise<FileItem[]> {
        try {
            const files = await fs.promises.readdir(dirPath);
            const items: FileItem[] = [];

            // 設定を取得
            const sortBy = this.configurationProvider.getSortBy();
            const sortOrder = this.configurationProvider.getSortOrder();
            const showFileIcons = this.configurationProvider.getShowFileIcons();

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                try {
                    const stat = await fs.promises.stat(filePath);
                    const isDirectory = stat.isDirectory();
                    const collapsibleState = isDirectory
                        ? vscode.TreeItemCollapsibleState.Collapsed
                        : vscode.TreeItemCollapsibleState.None;

                    const item = new FileItem(
                        file,
                        collapsibleState,
                        filePath,
                        isDirectory,
                        stat.size || 0,
                        stat.mtime || new Date(),
                        showFileIcons
                    );
                    // アイテムをキャッシュに保存
                    this.itemCache.set(filePath, item);
                    items.push(item);
                } catch (error) {
                    console.error(`ファイル情報の取得に失敗: ${filePath}`, error);
                }
            }

            // 設定に基づいてソート
            return this.sortItems(items, sortBy, sortOrder);
        } catch (error) {
            console.error(`ディレクトリ読み取りエラー: ${dirPath}`, error);
            return [];
        }
    }

    /**
     * 設定に基づいてアイテムをソート
     */
    private sortItems(items: FileItem[], sortBy: string, sortOrder: string): FileItem[] {
        return items.sort((a, b) => {
            // ディレクトリを常に先に表示
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }

            let comparison = 0;

            switch (sortBy) {
                case 'name':
                    comparison = a.label!.toString().localeCompare(b.label!.toString());
                    break;
                case 'type':
                    const extA = path.extname(a.label!.toString());
                    const extB = path.extname(b.label!.toString());
                    comparison = extA.localeCompare(extB);
                    if (comparison === 0) {
                        comparison = a.label!.toString().localeCompare(b.label!.toString());
                    }
                    break;
                case 'size':
                    comparison = (a.size || 0) - (b.size || 0);
                    break;
                case 'modified':
                    const timeA = a.modified?.getTime() || 0;
                    const timeB = b.modified?.getTime() || 0;
                    comparison = timeA - timeB;
                    break;
            }

            return sortOrder === 'ascending' ? comparison : -comparison;
        });
    }
}

// GitのHEADバージョンのコンテンツプロバイダー
class GitHeadContentProvider implements vscode.TextDocumentContentProvider {
    constructor(private content: string) {}

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.content;
    }
}

// ワークスペース設定アイテムクラス
class WorkspaceSettingItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly command: vscode.Command,
        public readonly iconPath: vscode.ThemeIcon
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = description;
    }
}

// ワークスペース設定プロバイダー
class WorkspaceSettingsProvider implements vscode.TreeDataProvider<WorkspaceSettingItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WorkspaceSettingItem | undefined | null | void> = new vscode.EventEmitter<WorkspaceSettingItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WorkspaceSettingItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: WorkspaceSettingItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: WorkspaceSettingItem): Thenable<WorkspaceSettingItem[]> {
        if (!element) {
            // ルートレベルの設定項目を返す
            return Promise.resolve([
                new WorkspaceSettingItem(
                    'settings.jsonを作成/編集',
                    'ワークスペース設定ファイルを作成または編集',
                    {
                        command: 'fileList.setupSettings',
                        title: 'settings.jsonを作成/編集'
                    },
                    new vscode.ThemeIcon('gear')
                ),
                new WorkspaceSettingItem(
                    '.claudeフォルダを設定',
                    'defaultRelativePathを.claudeに設定',
                    {
                        command: 'fileList.setupClaude',
                        title: '.claudeフォルダを設定'
                    },
                    new vscode.ThemeIcon('folder')
                ),
                new WorkspaceSettingItem(
                    'テンプレートをカスタマイズ',
                    'ファイル作成時のテンプレートをカスタマイズ',
                    {
                        command: 'fileList.setupTemplate',
                        title: 'テンプレートをカスタマイズ'
                    },
                    new vscode.ThemeIcon('file-text')
                )
            ]);
        }
        return Promise.resolve([]);
    }
}

export function deactivate() { }
