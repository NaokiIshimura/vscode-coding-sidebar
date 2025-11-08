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
import { FileWatcherService } from './services/FileWatcherService';

// デフォルトテンプレート内容
const DEFAULT_TEMPLATE = `created: {{datetime}}
file: {{filename}}

---

## overview


## tasks


`;

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
        console.error(`Failed to load template: ${error}`);
    }

    // テンプレートが見つからない場合のデフォルト
    let content = DEFAULT_TEMPLATE;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, value);
    }
    return content;
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
                console.error('Failed to parse settings.json:', error);
            }
        }

        // デフォルト設定を追加
        if (!settings.hasOwnProperty('aiCodingSidebar.defaultRelativePath')) {
            settings['aiCodingSidebar.defaultRelativePath'] = '.claude';
        }

        // settings.jsonに書き込み
        const settingsContent = JSON.stringify(settings, null, 2);
        fs.writeFileSync(settingsPath, settingsContent, 'utf8');

        // ファイルを開く
        const document = await vscode.workspace.openTextDocument(settingsPath);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage('Created/updated settings.json');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create settings.json: ${error}`);
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

        // テンプレートファイルが存在しない場合のみ作成
        if (!fs.existsSync(templatePath)) {
            fs.writeFileSync(templatePath, DEFAULT_TEMPLATE, 'utf8');
        }

        // ファイルを開く
        const document = await vscode.workspace.openTextDocument(templatePath);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage('Template file opened. Please edit and save.');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create template file: ${error}`);
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
        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
        await config.update('defaultRelativePath', '.claude', vscode.ConfigurationTarget.Workspace);

        vscode.window.showInformationMessage('Created .claude folder and updated settings');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to configure .claude folder: ${error}`);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Coding Sidebar activated');

    // サービスクラスの初期化
    const fileOperationService = new FileOperationService();
    const explorerManager = new ExplorerManager();
    const configProvider = new ConfigurationProvider();
    const searchService = new SearchService();
    const keyboardHandler = new KeyboardShortcutHandler(explorerManager, context);
    const contextMenuManager = new ContextMenuManager(explorerManager);

    // 共通のファイルウォッチャーサービスを作成
    const fileWatcherService = new FileWatcherService();
    context.subscriptions.push(fileWatcherService);

    // ステータスバーアイテムを作成
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(gear) AI Coding Sidebar Settings";
    statusBarItem.tooltip = "AI Coding Sidebar extension workspace settings";
    statusBarItem.command = "aiCodingSidebar.setupWorkspace";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // TreeDataProviderを作成
    const workspaceSettingsProvider = new WorkspaceSettingsProvider();
    const aiCodingSidebarProvider = new AiCodingSidebarProvider(fileWatcherService);
    const aiCodingSidebarDetailsProvider = new AiCodingSidebarDetailsProvider(aiCodingSidebarProvider, fileWatcherService);
    const gitChangesProvider = new GitChangesProvider(fileWatcherService);

    // プロジェクトルートを設定
    const initializeWithWorkspaceRoot = async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // 設定から相対パスを取得
        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
        const defaultRelativePath = config.get<string>('defaultRelativePath');

        let targetPath: string;
        let relativePath: string | undefined;

        if (defaultRelativePath && defaultRelativePath.trim()) {
            // 相対パスを絶対パスに変換
            relativePath = defaultRelativePath.trim();
            targetPath = path.resolve(workspaceRoot, relativePath);
        } else {
            // ワークスペースルートを使用
            targetPath = workspaceRoot;
            relativePath = undefined;
        }

        aiCodingSidebarProvider.setRootPath(targetPath, relativePath);

        // ファイル一覧ペインにも同じパスを設定（パスが存在する場合のみ）
        try {
            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) {
                aiCodingSidebarDetailsProvider.setRootPath(targetPath);
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

    const treeView = vscode.window.createTreeView('aiCodingSidebarExplorer', {
        treeDataProvider: aiCodingSidebarProvider,
        showCollapseAll: true
    });

    // TreeViewをProviderに設定
    aiCodingSidebarProvider.setTreeView(treeView);

    // ビューの可視性変更を監視
    treeView.onDidChangeVisibility(() => {
        aiCodingSidebarProvider.handleVisibilityChange(treeView.visible);
    });

    const detailsView = vscode.window.createTreeView('aiCodingSidebarDetails', {
        treeDataProvider: aiCodingSidebarDetailsProvider,
        showCollapseAll: true,
        canSelectMany: false,
        dragAndDropController: aiCodingSidebarDetailsProvider
    });

    // AiCodingSidebarDetailsProviderにdetailsViewの参照を渡す
    aiCodingSidebarDetailsProvider.setTreeView(detailsView);

    // ビューの可視性変更を監視
    detailsView.onDidChangeVisibility(() => {
        aiCodingSidebarDetailsProvider.handleVisibilityChange(detailsView.visible);
    });

    const gitChangesView = vscode.window.createTreeView('gitChanges', {
        treeDataProvider: gitChangesProvider,
        showCollapseAll: false
    });

    // ビューの可視性変更を監視
    gitChangesView.onDidChangeVisibility(() => {
        gitChangesProvider.handleVisibilityChange(gitChangesView.visible);
    });



    // 初期化を実行
    initializeWithWorkspaceRoot();


    // 初期化後にルートフォルダを選択状態にする
    setTimeout(async () => {
        const currentRootPath = aiCodingSidebarProvider.getRootPath();
        if (currentRootPath) {
            await selectInitialFolder(treeView, currentRootPath);
            // ファイル一覧ペインにも同じパスを確実に設定
            aiCodingSidebarDetailsProvider.setRootPath(currentRootPath);
        }
    }, 500);

    // フォルダ選択時に下ペインにファイル一覧を表示
    treeView.onDidChangeSelection(async (e) => {
        if (e.selection.length > 0) {
            const selectedItem = e.selection[0];
            if (selectedItem.isDirectory) {
                aiCodingSidebarDetailsProvider.setRootPath(selectedItem.filePath);
            }
        }
    });

    // ファイル一覧ビューの選択状態を追跡（無効化）
    // 選択状態を保持しないことで、常に現在のフォルダ直下に作成される
    /*
    detailsView.onDidChangeSelection(async (e) => {
        if (e.selection.length > 0) {
            aiCodingSidebarDetailsProvider.setSelectedItem(e.selection[0]);
        } else {
            aiCodingSidebarDetailsProvider.setSelectedItem(undefined);
        }
    });
    */

    // ビューを有効化
    vscode.commands.executeCommand('setContext', 'aiCodingSidebarView:enabled', true);

    // 更新コマンドを登録
    const refreshCommand = vscode.commands.registerCommand('aiCodingSidebar.refresh', () => {
        aiCodingSidebarProvider.refresh();
    });

    // 下ペイン表示コマンドを登録
    const showInPanelCommand = vscode.commands.registerCommand('aiCodingSidebar.showInPanel', async (item: FileItem) => {
        if (item && item.isDirectory) {
            aiCodingSidebarDetailsProvider.setRootPath(item.filePath);
        }
    });

    // フォルダを開くコマンドを登録
    const openFolderCommand = vscode.commands.registerCommand('aiCodingSidebar.openFolder', async (folderPath: string) => {
        aiCodingSidebarDetailsProvider.setRootPath(folderPath);
    });

    // 親フォルダへ移動するコマンドを登録
    const goToParentCommand = vscode.commands.registerCommand('aiCodingSidebar.goToParent', async () => {
        // フォルダツリーviewの親フォルダへ移動
        const currentPath = aiCodingSidebarProvider.getRootPath();
        if (currentPath) {
            const parentPath = path.dirname(currentPath);

            // プロジェクトルートより上には移動しない
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot && parentPath.startsWith(workspaceRoot) && parentPath !== currentPath) {
                aiCodingSidebarProvider.setRootPath(parentPath);
                // ファイル一覧ペインも同期
                aiCodingSidebarDetailsProvider.setRootPath(parentPath);
            } else {
                vscode.window.showInformationMessage('No parent folder available');
            }
        } else {
            // フォルダツリーにパスが設定されていない場合は、ファイル一覧ペインの親フォルダへ移動
            aiCodingSidebarDetailsProvider.goToParentFolder();
        }
    });

    // 相対パス設定コマンドを登録
    const setRelativePathCommand = vscode.commands.registerCommand('aiCodingSidebar.setRelativePath', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const currentPath = aiCodingSidebarProvider.getRootPath() || workspaceRoot;

        // 現在のパスから相対パスを計算
        const currentRelativePath = path.relative(workspaceRoot, currentPath);
        const displayPath = currentRelativePath === '' ? '.' : currentRelativePath;

        const inputPath = await vscode.window.showInputBox({
            prompt: `Enter relative path from workspace root (${path.basename(workspaceRoot)})`,
            value: displayPath,
            placeHolder: 'src, docs/api, .claude, . (root)'
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
                vscode.window.showErrorMessage(`Specified path is not a directory: ${targetPath}`);
                return;
            }

            if (!pathExists) {
                const continueChoice = await vscode.window.showWarningMessage(
                    `Specified path not found:\nRelative path: ${trimmedPath}\nAbsolute path: ${targetPath}\n\nContinue anyway?`,
                    'Yes',
                    'No'
                );

                if (continueChoice !== 'Yes') {
                    return;
                }
            }

            // パスを設定（存在しなくても設定）
            aiCodingSidebarProvider.setRootPath(targetPath);

            // ファイル一覧ペインにも同じパスを設定（存在する場合のみ）
            if (pathExists) {
                aiCodingSidebarDetailsProvider.setRootPath(targetPath);
            }

            // 設定に保存するかユーザーに確認
            const relativePathToSave = trimmedPath === '' || trimmedPath === '.' ? '' : trimmedPath;
            const saveChoice = await vscode.window.showInformationMessage(
                `Save relative path "${relativePathToSave || '.'}" to settings?`,
                'Yes',
                'No'
            );

            if (saveChoice === 'Yes') {
                const config = vscode.workspace.getConfiguration('aiCodingSidebar');
                await config.update('defaultRelativePath', relativePathToSave, vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage('Saved to settings');
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
    const openSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodingSidebar');
    });

    // フォルダツリー設定を開くコマンドを登録
    const openFolderTreeSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openFolderTreeSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodingSidebar.defaultRelativePath');
    });

    // ワークスペース設定コマンドを登録
    const setupWorkspaceCommand = vscode.commands.registerCommand('aiCodingSidebar.setupWorkspace', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // 設定オプションを表示
        const options = [
            {
                label: '$(gear) Create/Edit settings.json',
                description: 'Create or edit workspace settings file',
                action: 'settings'
            },
            {
                label: '$(file-text) Customize Template',
                description: 'Customize template for file creation',
                action: 'template'
            },
            {
                label: '$(folder) Configure .claude Folder',
                description: 'Set defaultRelativePath to .claude',
                action: 'claude'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select an item to configure'
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
    const openUserSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openUserSettings', async () => {
        try {
            // ユーザ設定を開き、aiCodingSidebarでフィルタする
            await vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'aiCodingSidebar'
            );
        } catch (error) {
            vscode.window.showErrorMessage('Failed to open user settings');
        }
    });

    const openWorkspaceSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openWorkspaceSettings', async () => {
        try {
            // ワークスペース設定を開き、aiCodingSidebarでフィルタする
            await vscode.commands.executeCommand(
                'workbench.action.openWorkspaceSettings',
                'aiCodingSidebar'
            );
        } catch (error) {
            vscode.window.showErrorMessage('Failed to open workspace settings');
        }
    });

    const setupTemplateCommand = vscode.commands.registerCommand('aiCodingSidebar.setupTemplate', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        await setupTemplate(workspaceRoot);
    });

    // Gitファイルを開くコマンドを登録
    const openGitFileCommand = vscode.commands.registerCommand('aiCodingSidebar.openGitFile', async (item: GitFileItem) => {
        if (item && item.filePath) {
            const document = await vscode.workspace.openTextDocument(item.filePath);
            await vscode.window.showTextDocument(document);
        }
    });

    // Git差分を表示するコマンドを登録
    const showGitDiffCommand = vscode.commands.registerCommand('aiCodingSidebar.showGitDiff', async (item: GitFileItem) => {
        if (item && item.filePath) {
            await gitChangesProvider.showDiff(item);
        }
    });

    // Git変更を更新するコマンドを登録
    const refreshGitChangesCommand = vscode.commands.registerCommand('aiCodingSidebar.refreshGitChanges', () => {
        gitChangesProvider.refresh();
    });

    // markdownファイルを作成するコマンドを登録
    const createMarkdownFileCommand = vscode.commands.registerCommand('aiCodingSidebar.createMarkdownFile', async (item?: FileItem) => {
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
            const currentPath = aiCodingSidebarDetailsProvider.getCurrentPath();
            if (!currentPath) {
                vscode.window.showErrorMessage('No folder is open in the file list pane');
                return;
            }
            targetPath = currentPath;
        }

        // 現在の日時を YYYY_MMDD_HHMM 形式で取得
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');

        const timestamp = `${year}_${month}${day}_${hour}${minute}`;
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
                aiCodingSidebarDetailsProvider.refresh();

                // 作成したファイルを開く
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);

                vscode.window.showInformationMessage(`Created markdown file ${fileName}`);
            } else {
                throw result.error || new Error('Failed to create file');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create markdown file: ${error}`);
        }
    });

    // 任意のファイルを作成するコマンドを登録
    const createFileCommand = vscode.commands.registerCommand('aiCodingSidebar.createFile', async (item?: FileItem) => {
        let targetDirectory: string | undefined;

        if (item) {
            targetDirectory = item.isDirectory ? item.filePath : path.dirname(item.filePath);
        } else {
            targetDirectory = aiCodingSidebarDetailsProvider.getCurrentPath()
                || aiCodingSidebarProvider.getRootPath()
                || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        }

        if (!targetDirectory) {
            vscode.window.showErrorMessage('Failed to identify folder for file creation');
            return;
        }

        try {
            if (!fs.existsSync(targetDirectory) || !fs.statSync(targetDirectory).isDirectory()) {
                vscode.window.showErrorMessage('Cannot access target folder');
                return;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Cannot access target folder: ${error}`);
            return;
        }

        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter new file name',
            placeHolder: 'example.txt',
            validateInput: (value: string) => {
                const trimmed = value.trim();

                if (!trimmed) {
                    return 'Please enter a file name';
                }

                if (trimmed.includes('/') || trimmed.includes('\\')) {
                    return 'Cannot specify path with folders';
                }

                if (!fileOperationService.validateFileName(trimmed)) {
                    return 'Contains invalid characters';
                }

                const candidatePath = path.join(targetDirectory!, trimmed);
                if (fs.existsSync(candidatePath)) {
                    return `File "${trimmed}" already exists`;
                }

                return null;
            }
        });

        if (!fileName) {
            return;
        }

        const trimmedFileName = fileName.trim();
        const newFilePath = path.join(targetDirectory, trimmedFileName);

        try {
            const result = await fileOperationService.createFile(newFilePath);

            if (result.success) {
                aiCodingSidebarDetailsProvider.refresh();
                aiCodingSidebarProvider.refresh();

                const document = await vscode.workspace.openTextDocument(newFilePath);
                await vscode.window.showTextDocument(document);

                vscode.window.showInformationMessage(`Created file "${trimmedFileName}"`);
            } else {
                throw result.error || new Error('Failed to create file');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create file: ${error}`);
        }
    });

    // フォルダを作成するコマンドを登録
    const createFolderCommand = vscode.commands.registerCommand('aiCodingSidebar.createFolder', async (item?: FileItem) => {
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
            const currentPath = aiCodingSidebarDetailsProvider.getCurrentPath();
            if (!currentPath) {
                vscode.window.showErrorMessage('No folder is open in the file list pane');
                return;
            }
            targetPath = currentPath;
        }

        // フォルダ名をユーザーに入力してもらう
        const folderName = await vscode.window.showInputBox({
            prompt: 'Enter new folder name',
            placeHolder: 'Folder name',
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Please enter a folder name';
                }
                // 不正な文字をチェック
                if (value.match(/[<>:"|?*\/\\]/)) {
                    return 'Contains invalid characters: < > : " | ? * / \\';
                }
                // 既存フォルダとの重複チェック
                const folderPath = path.join(targetPath, value.trim());
                if (fs.existsSync(folderPath)) {
                    return `Folder "${value.trim()}" already exists`;
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
                aiCodingSidebarDetailsProvider.refresh();
                aiCodingSidebarProvider.refresh();

                vscode.window.showInformationMessage(`Created folder "${trimmedFolderName}"`);
            } else {
                throw result.error || new Error('Failed to create folder');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
        }
    });

    // リネームコマンドを登録
    const renameCommand = vscode.commands.registerCommand('aiCodingSidebar.rename', async (item: FileItem) => {
        if (!item) {
            vscode.window.showErrorMessage('No item is selected');
            return;
        }

        const oldName = path.basename(item.filePath);
        const dirPath = path.dirname(item.filePath);

        // 新しい名前の入力を求める
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name',
            value: oldName,
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Please enter a name';
                }
                // 不正な文字をチェック
                if (value.match(/[<>:"|?*\/\\]/)) {
                    return 'Contains invalid characters: < > : " | ? * / \\';
                }
                // 同じ名前の場合
                if (value === oldName) {
                    return 'Same name';
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
                aiCodingSidebarDetailsProvider.refresh();

                vscode.window.showInformationMessage(`Renamed ${oldName} to ${newName}`);
            } else {
                throw result.error || new Error('Failed to rename');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename: ${error}`);
        }
    });

    // 削除コマンドを登録
    const deleteCommand = vscode.commands.registerCommand('aiCodingSidebar.delete', async (item: FileItem) => {
        if (!item) {
            vscode.window.showErrorMessage('No item is selected');
            return;
        }

        const itemName = path.basename(item.filePath);
        const itemType = item.isDirectory ? 'folder' : 'file';

        // 確認ダイアログを表示
        const answer = await vscode.window.showWarningMessage(
            `Are you sure you want to delete ${itemType} "${itemName}"?\nThis action cannot be undone.`,
            'Yes',
            'No'
        );

        if (answer !== 'Yes') {
            return;
        }

        try {
            // FileOperationServiceを使用して削除
            const result = await fileOperationService.deleteFiles([item.filePath]);

            if (result[0].success) {
                // フォルダを削除した場合は選択状態を親フォルダへ移す
                let treeUpdated = false;

                if (item.isDirectory) {
                    const rootPath = aiCodingSidebarProvider.getRootPath();
                    if (rootPath) {
                        if (item.filePath === rootPath) {
                            aiCodingSidebarProvider.resetActiveFolder();
                            treeUpdated = true;
                        } else {
                            const parentPath = path.dirname(item.filePath);
                            if (parentPath && parentPath.startsWith(rootPath) && fs.existsSync(parentPath)) {
                                aiCodingSidebarProvider.setActiveFolder(parentPath, true);
                                treeUpdated = true;
                            } else {
                                aiCodingSidebarProvider.resetActiveFolder();
                                treeUpdated = true;
                            }
                        }
                    } else {
                        aiCodingSidebarProvider.resetActiveFolder();
                        treeUpdated = true;
                    }
                }

                if (!treeUpdated) {
                    aiCodingSidebarProvider.refresh();
                }

                // ビューを更新
                aiCodingSidebarDetailsProvider.refresh();

                vscode.window.showInformationMessage(`Deleted ${itemType} "${itemName}"`);
            } else {
                throw result[0].error || new Error('Failed to delete');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete: ${error}`);
        }
    });

    // フォルダを追加コマンドを登録（フォルダツリーview用）
    const addFolderCommand = vscode.commands.registerCommand('aiCodingSidebar.addFolder', async (item?: FileItem) => {
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
            const currentPath = aiCodingSidebarProvider.getRootPath();
            if (!currentPath) {
                vscode.window.showErrorMessage('No folder is open');
                return;
            }
            targetPath = currentPath;
        }

        // フォルダ名をユーザーに入力してもらう
        const folderName = await vscode.window.showInputBox({
            prompt: 'Enter new folder name',
            placeHolder: 'Folder name',
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Please enter a folder name';
                }
                // 不正な文字をチェック
                if (value.match(/[<>:"|?*\/\\]/)) {
                    return 'Contains invalid characters: < > : " | ? * / \\';
                }
                // 既存フォルダとの重複チェック
                const folderPath = path.join(targetPath, value.trim());
                if (fs.existsSync(folderPath)) {
                    return `Folder "${value.trim()}" already exists`;
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
            vscode.window.showInformationMessage(`Created folder "${trimmedFolderName}"`);

            // ビューを更新
            aiCodingSidebarDetailsProvider.refresh();
            aiCodingSidebarProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
        }
    });

    // フォルダ削除コマンドを登録（フォルダツリーview用）
    const deleteFolderCommand = vscode.commands.registerCommand('aiCodingSidebar.deleteFolder', async (item?: FileItem) => {
        if (!item || !item.isDirectory) {
            vscode.window.showErrorMessage('No folder is selected');
            return;
        }

        await vscode.commands.executeCommand('aiCodingSidebar.delete', item);
    });

    // ブランチチェックアウトコマンドを登録
    const checkoutBranchCommand = vscode.commands.registerCommand('aiCodingSidebar.checkoutBranch', async (item?: FileItem) => {
        if (!item || !item.isDirectory) {
            vscode.window.showErrorMessage('No folder is selected');
            return;
        }

        // ディレクトリ名を取得
        const directoryName = path.basename(item.filePath);

        // ブランチ名の確認ダイアログを表示
        const branchName = await vscode.window.showInputBox({
            prompt: 'Enter branch name to checkout',
            value: directoryName,
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Please enter a branch name';
                }
                // Git ブランチ名として不正な文字をチェック
                if (value.match(/[\s~^:?*\[\\]/)) {
                    return 'Contains invalid characters for git branch name';
                }
                return null;
            }
        });

        if (!branchName || branchName.trim() === '') {
            return;
        }

        const trimmedBranchName = branchName.trim();

        try {
            // Git リポジトリのルートディレクトリを取得
            const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
            const git = gitExtension?.getAPI(1);

            if (!git) {
                vscode.window.showErrorMessage('Git extension is not available');
                return;
            }

            if (git.repositories.length === 0) {
                vscode.window.showErrorMessage('No git repository found');
                return;
            }

            const repository = git.repositories[0];

            // 既存のブランチを確認
            const branches = await repository.getBranches({ remote: false });
            const existingBranch = branches.find((branch: any) => branch.name === trimmedBranchName);

            if (existingBranch) {
                // 既存のブランチにチェックアウト
                await repository.checkout(trimmedBranchName);
                vscode.window.showInformationMessage(`Checked out branch "${trimmedBranchName}"`);
            } else {
                // 新しいブランチを作成してチェックアウト
                await repository.createBranch(trimmedBranchName, true);
                vscode.window.showInformationMessage(`Created and checked out branch "${trimmedBranchName}"`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to checkout branch: ${error}`);
        }
    });

    // 相対パスをコピーコマンドを登録
    const copyRelativePathCommand = vscode.commands.registerCommand('aiCodingSidebar.copyRelativePath', async (item?: FileItem | vscode.Uri) => {
        if (!item) {
            vscode.window.showErrorMessage('No file or folder is selected');
            return;
        }

        // ワークスペースルートを取得
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // ファイルパスを取得（UriオブジェクトとFileItemの両方に対応）
        const filePath = item instanceof vscode.Uri ? item.fsPath : (item as FileItem).filePath;

        // 相対パスを計算
        const relativePath = path.relative(workspaceRoot, filePath);

        // クリップボードにコピー
        await vscode.env.clipboard.writeText(relativePath);
        vscode.window.showInformationMessage(`Copied relative path: ${relativePath}`);
    });

    // デフォルトパスを作成するコマンドを登録
    const createDefaultPathCommand = vscode.commands.registerCommand('aiCodingSidebar.createDefaultPath', async (targetPath: string, relativePath?: string) => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            // ディレクトリを作成
            fs.mkdirSync(targetPath, { recursive: true });

            // 作成成功メッセージ
            const displayPath = relativePath || path.relative(workspaceRoot, targetPath);
            vscode.window.showInformationMessage(`Created directory: ${displayPath}`);

            // ビューを更新
            aiCodingSidebarProvider.setRootPath(targetPath, relativePath);
            aiCodingSidebarDetailsProvider.setRootPath(targetPath);

            // フォルダを選択状態にする
            setTimeout(async () => {
                await selectInitialFolder(treeView, targetPath);
            }, 300);

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create directory: ${error}`);
        }
    });

    context.subscriptions.push(refreshCommand, showInPanelCommand, openFolderCommand, goToParentCommand, setRelativePathCommand, openSettingsCommand, openFolderTreeSettingsCommand, setupWorkspaceCommand, openUserSettingsCommand, openWorkspaceSettingsCommand, setupTemplateCommand, openGitFileCommand, showGitDiffCommand, refreshGitChangesCommand, createMarkdownFileCommand, createFileCommand, createFolderCommand, renameCommand, deleteCommand, addFolderCommand, deleteFolderCommand, checkoutBranchCommand, copyRelativePathCommand, createDefaultPathCommand);

    // プロバイダーのリソースクリーンアップを登録
    context.subscriptions.push({
        dispose: () => {
            aiCodingSidebarProvider.dispose();
            aiCodingSidebarDetailsProvider.dispose();
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
        console.log('Failed to select initial folder:', error);
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
        throw new Error(`Failed to read directory: ${error}`);
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
class AiCodingSidebarProvider implements vscode.TreeDataProvider<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private rootPath: string | undefined;
    private treeView: vscode.TreeView<FileItem> | undefined;
    private itemCache: Map<string, FileItem[]> = new Map();  // パスをキーとしたFileItemのキャッシュ
    private activeFolderPath: string | undefined;
    private refreshDebounceTimer: NodeJS.Timeout | undefined;
    private readonly listenerId = 'ai-coding-sidebar';
    private fileWatcherService: FileWatcherService | undefined;
    private pathNotFound: boolean = false;
    private configuredRelativePath: string | undefined;

    constructor(fileWatcherService?: FileWatcherService) {
        this.fileWatcherService = fileWatcherService;
    }

    setTreeView(treeView: vscode.TreeView<FileItem>): void {
        this.treeView = treeView;
    }

    setRootPath(path: string, relativePath?: string): void {
        this.rootPath = path;
        this.activeFolderPath = path;
        this.configuredRelativePath = relativePath;

        // パスの存在確認
        try {
            const stat = fs.statSync(path);
            if (!stat.isDirectory()) {
                this.pathNotFound = true;
            } else {
                this.pathNotFound = false;
            }
        } catch (error) {
            this.pathNotFound = true;
        }

        this.updateTitle();
        this.setupFileWatcher();
        this.refresh();
    }

    getConfiguredRelativePath(): string | undefined {
        return this.configuredRelativePath;
    }

    private setupFileWatcher(): void {
        if (!this.fileWatcherService || !this.rootPath) {
            return;
        }

        // 共通のファイルウォッチャーサービスにリスナーを登録
        this.fileWatcherService.registerListener(this.listenerId, (uri) => {
            this.debouncedRefresh(uri.fsPath);
        });
    }

    /**
     * ビューの可視性に応じてファイルウォッチャーを制御
     */
    handleVisibilityChange(visible: boolean): void {
        if (!this.fileWatcherService) {
            return;
        }

        if (visible) {
            this.fileWatcherService.enableListener(this.listenerId);
        } else {
            this.fileWatcherService.disableListener(this.listenerId);
        }
    }

    dispose(): void {
        if (this.fileWatcherService) {
            this.fileWatcherService.unregisterListener(this.listenerId);
        }
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = undefined;
        }
    }

    private updateTitle(): void {
        if (this.treeView && this.rootPath) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot) {
                const relativePath = path.relative(workspaceRoot, this.rootPath);
                const displayPath = relativePath === '' ? '.' : relativePath;
                this.treeView.title = `Directory List - ${displayPath}`;
            } else {
                const folderName = path.basename(this.rootPath);
                this.treeView.title = `Directory List - ${folderName}`;
            }
        }
    }

    getRootPath(): string | undefined {
        return this.rootPath;
    }

    refresh(targetPath?: string): void {
        if (targetPath) {
            // 特定のパスとその親ディレクトリのキャッシュのみクリア
            this.itemCache.delete(targetPath);
            const parentPath = path.dirname(targetPath);
            if (parentPath && parentPath !== targetPath) {
                this.itemCache.delete(parentPath);
            }
        } else {
            // 全体更新の場合のみ全キャッシュをクリア
            this.itemCache.clear();
        }
        this._onDidChangeTreeData.fire();
    }

    private debouncedRefresh(targetPath?: string): void {
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }
        this.refreshDebounceTimer = setTimeout(() => {
            this.refresh(targetPath);
        }, 1500);  // 500ms → 1500msに延長
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        if (!this.rootPath) {
            return Promise.resolve([]);
        }

        // ルートレベルでパスが存在しない場合は、作成ボタンを表示
        if (!element && this.pathNotFound) {
            const createButton = new FileItem(
                `Create directory: ${this.configuredRelativePath || this.rootPath}`,
                vscode.TreeItemCollapsibleState.None,
                this.rootPath,
                false,
                0,
                new Date()
            );
            createButton.contextValue = 'createDirectoryButton';
            createButton.iconPath = new vscode.ThemeIcon('new-folder');
            createButton.command = {
                command: 'aiCodingSidebar.createDefaultPath',
                title: 'Create Directory',
                arguments: [this.rootPath, this.configuredRelativePath]
            };
            createButton.tooltip = `Click to create directory: ${this.configuredRelativePath || this.rootPath}`;
            return Promise.resolve([createButton]);
        }

        // ルートレベル（element が undefined）の場合、rootPath 自体をノードとして返す
        if (!element) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            let displayName: string;

            if (workspaceRoot) {
                const relativePath = path.relative(workspaceRoot, this.rootPath);
                displayName = relativePath === '' ? path.basename(this.rootPath) : relativePath;
            } else {
                displayName = path.basename(this.rootPath);
            }

            const rootItem = new FileItem(
                displayName,
                vscode.TreeItemCollapsibleState.Expanded,
                this.rootPath,
                true,
                0,
                new Date()
            );
            rootItem.contextValue = 'directory';

            return Promise.resolve([rootItem]);
        }

        const targetPath = element.resourceUri!.fsPath;

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
                    item.description = 'Selected';
                    item.tooltip = `${item.tooltip}\nCurrent folder`;
                }

                return item;
            });

            // キャッシュに保存
            this.itemCache.set(targetPath, items);
            return Promise.resolve(items);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read directory: ${error}`);
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

        // rootItem自体の親はundefined
        if (element.filePath === this.rootPath) {
            return undefined;
        }

        const parentPath = path.dirname(element.filePath);

        if (!parentPath || parentPath === element.filePath) {
            return undefined;
        }

        // 親がrootPathの場合、rootPath自体を表すFileItemを返す
        if (parentPath === this.rootPath) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            let displayName: string;

            if (workspaceRoot) {
                const relativePath = path.relative(workspaceRoot, this.rootPath);
                displayName = relativePath === '' ? path.basename(this.rootPath) : relativePath;
            } else {
                displayName = path.basename(this.rootPath);
            }

            return new FileItem(
                displayName,
                vscode.TreeItemCollapsibleState.Expanded,
                this.rootPath,
                true,
                0,
                new Date()
            );
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
            console.error('Failed to get parent folder:', error);
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
            console.error('Failed to show folder selection:', error);
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
            throw new Error(`Failed to read directory: ${message}`);
        }

        return files;
    }


}

// ファイル詳細用TreeDataProvider実装（フォルダツリーと同じ機能）
class AiCodingSidebarDetailsProvider implements vscode.TreeDataProvider<FileItem>, vscode.TreeDragAndDropController<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private rootPath: string | undefined;
    private projectRootPath: string | undefined;
    private treeView: vscode.TreeView<FileItem> | undefined;
    private selectedItem: FileItem | undefined;
    private itemCache: Map<string, FileItem[]> = new Map();  // パスをキーとしたFileItemのキャッシュ
    private refreshDebounceTimer: NodeJS.Timeout | undefined;
    private readonly listenerId = 'ai-coding-sidebar-details';
    private fileWatcherService: FileWatcherService | undefined;

    constructor(
        private readonly folderTreeProvider: AiCodingSidebarProvider,
        fileWatcherService?: FileWatcherService
    ) {
        this.fileWatcherService = fileWatcherService;
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
            if (this.projectRootPath) {
                const relativePath = path.relative(this.projectRootPath, this.rootPath);
                const displayPath = relativePath === '' ? '.' : relativePath;
                this.treeView.title = `Markdown List - ${displayPath}`;
            } else {
                const folderName = path.basename(this.rootPath);
                this.treeView.title = `Markdown List - ${folderName}`;
            }
        }
    }

    goToParentFolder(): void {
        if (!this.rootPath) {
            return;
        }

        // 現在のパスがルートディレクトリかどうかをチェック
        if (path.dirname(this.rootPath) === this.rootPath) {
            vscode.window.showInformationMessage('No parent folder available');
            return;
        }

        const parentPath = path.dirname(this.rootPath);

        // プロジェクトルートより上には移動しない
        if (this.projectRootPath && !parentPath.startsWith(this.projectRootPath)) {
            vscode.window.showInformationMessage('Cannot move above project root');
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
        if (!this.fileWatcherService || !this.rootPath) {
            return;
        }

        // 共通のファイルウォッチャーサービスにリスナーを登録
        this.fileWatcherService.registerListener(this.listenerId, (uri) => {
            this.debouncedRefresh(uri.fsPath);
        });
    }

    /**
     * ビューの可視性に応じてファイルウォッチャーを制御
     */
    handleVisibilityChange(visible: boolean): void {
        if (!this.fileWatcherService) {
            return;
        }

        if (visible) {
            this.fileWatcherService.enableListener(this.listenerId);
        } else {
            this.fileWatcherService.disableListener(this.listenerId);
        }
    }

    dispose(): void {
        if (this.fileWatcherService) {
            this.fileWatcherService.unregisterListener(this.listenerId);
        }
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = undefined;
        }
    }

    refresh(targetPath?: string): void {
        if (targetPath) {
            // 特定のパスとその親ディレクトリのキャッシュのみクリア
            this.itemCache.delete(targetPath);
            const parentPath = path.dirname(targetPath);
            if (parentPath && parentPath !== targetPath) {
                this.itemCache.delete(parentPath);
            }
        } else {
            // 全体更新の場合のみ全キャッシュをクリア
            this.itemCache.clear();
        }
        this._onDidChangeTreeData.fire();
    }

    private debouncedRefresh(targetPath?: string): void {
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }
        this.refreshDebounceTimer = setTimeout(() => {
            this.refresh(targetPath);
        }, 1500);  // 500ms → 1500msに延長
    }

    private getRelativePath(fullPath: string): string {
        if (!this.projectRootPath) {
            return fullPath;
        }

        const relativePath = path.relative(this.projectRootPath, fullPath);
        return relativePath || '.'; // ルートの場合は '.' を返す
    }

    // ドラッグ&ドロップのサポート
    readonly dragMimeTypes = ['application/vnd.code.tree.aiCodingSidebarDetails'];
    readonly dropMimeTypes = ['application/vnd.code.tree.aiCodingSidebarDetails', 'text/uri-list'];

    handleDrag(source: readonly FileItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        dataTransfer.set('application/vnd.code.tree.aiCodingSidebarDetails', new vscode.DataTransferItem(source));
    }

    handleDrop(target: FileItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        const transferItem = dataTransfer.get('application/vnd.code.tree.aiCodingSidebarDetails');
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
                        `${fileName} already exists. Overwrite?`,
                        'Overwrite',
                        'Skip'
                    );
                    if (answer !== 'Overwrite') {
                        continue;
                    }
                }

                // ファイル/フォルダを移動
                fs.renameSync(sourcePath, targetPath);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to move ${fileName}: ${error}`);
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
            vscode.window.showErrorMessage(`Failed to read directory: ${error}`);
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
            throw new Error(`Failed to read directory: ${message}`);
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
        const sizeText = isDirectory ? 'Directory' : formatFileSize(size);
        this.tooltip = `${label}\nType: ${sizeText}\nLast modified: ${modified.toLocaleString('en-US')}`;

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
    private readonly listenerId = 'git-changes';
    private fileWatcherService: FileWatcherService | undefined;

    constructor(fileWatcherService?: FileWatcherService) {
        this.fileWatcherService = fileWatcherService;

        if (this.fileWatcherService) {
            // 共通のファイルウォッチャーサービスにリスナーを登録
            this.fileWatcherService.registerListener(this.listenerId, (uri) => {
                this.debouncedRefresh();
            });
            // デフォルトで有効化
            this.fileWatcherService.enableListener(this.listenerId);
        }
    }

    private debouncedRefresh(): void {
        // 既存のタイマーをクリア
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        // 1500ms後に実行（連続した変更をまとめ、git操作との競合を回避）
        this.refreshDebounceTimer = setTimeout(() => {
            this.refresh();
        }, 1500);  // 1000ms → 1500msに延長
    }

    refresh(): void {
        // git操作中の場合はスキップ
        if (this.isGitOperationInProgress) {
            console.log('Git operation in progress, skipping refresh');
            return;
        }
        this._onDidChangeTreeData.fire();
    }

    /**
     * ビューの可視性に応じてファイルウォッチャーを制御
     */
    handleVisibilityChange(visible: boolean): void {
        if (!this.fileWatcherService) {
            return;
        }

        if (visible) {
            this.fileWatcherService.enableListener(this.listenerId);
        } else {
            this.fileWatcherService.disableListener(this.listenerId);
        }
    }

    dispose(): void {
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }
        if (this.fileWatcherService) {
            this.fileWatcherService.unregisterListener(this.listenerId);
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
            vscode.window.showErrorMessage(`Failed to show diff: ${error}`);
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
                console.log('Failed to get files in directory:', error);
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
            console.log('Failed to get Git changes:', error);
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

    private async getFilesInDirectory(dirPath: string): Promise<{ name: string, path: string, relativePath: string, isDirectory: boolean }[]> {
        const files: { name: string, path: string, relativePath: string, isDirectory: boolean }[] = [];

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
            console.log('Failed to read directory:', error);
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
                command: 'aiCodingSidebar.showGitDiff',
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


// GitのHEADバージョンのコンテンツプロバイダー
class GitHeadContentProvider implements vscode.TextDocumentContentProvider {
    constructor(private content: string) { }

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.content;
    }
}

// ワークスペース設定アイテムクラス
class WorkspaceSettingItem extends vscode.TreeItem {
    public readonly children?: WorkspaceSettingItem[];

    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly command: vscode.Command | undefined,
        public readonly iconPath: vscode.ThemeIcon,
        children?: WorkspaceSettingItem[],
        collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState || vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = description;
        this.children = children;
    }
}

// ワークスペース設定プロバイダー
class WorkspaceSettingsProvider implements vscode.TreeDataProvider<WorkspaceSettingItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WorkspaceSettingItem | undefined | null | void> = new vscode.EventEmitter<WorkspaceSettingItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WorkspaceSettingItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: WorkspaceSettingItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: WorkspaceSettingItem): Thenable<WorkspaceSettingItem[]> {
        if (!element) {
            // ルートレベル: グローバルとワークスペースの2つの親項目を返す
            return Promise.resolve([
                // グローバル（親項目）
                new WorkspaceSettingItem(
                    'Global',
                    'User-level settings',
                    undefined,
                    new vscode.ThemeIcon('account'),
                    [
                        new WorkspaceSettingItem(
                            'Open User Settings',
                            'Open AI Coding Sidebar user settings',
                            {
                                command: 'aiCodingSidebar.openUserSettings',
                                title: 'Open User Settings'
                            },
                            new vscode.ThemeIcon('settings-gear')
                        )
                    ],
                    vscode.TreeItemCollapsibleState.Collapsed
                ),
                // ワークスペース（親項目）
                new WorkspaceSettingItem(
                    'Workspace',
                    'Workspace-level settings',
                    undefined,
                    new vscode.ThemeIcon('folder-opened'),
                    [
                        new WorkspaceSettingItem(
                            'Open Workspace Settings',
                            'Open AI Coding Sidebar workspace settings',
                            {
                                command: 'aiCodingSidebar.openWorkspaceSettings',
                                title: 'Open Workspace Settings'
                            },
                            new vscode.ThemeIcon('settings-gear')
                        ),
                        new WorkspaceSettingItem(
                            'Customize Template',
                            'Customize template for file creation',
                            {
                                command: 'aiCodingSidebar.setupTemplate',
                                title: 'Customize Template'
                            },
                            new vscode.ThemeIcon('file-text')
                        )
                    ],
                    vscode.TreeItemCollapsibleState.Collapsed
                ),
                // Note（親項目）
                new WorkspaceSettingItem(
                    'Note',
                    'Keyboard shortcuts and tips',
                    undefined,
                    new vscode.ThemeIcon('info'),
                    [
                        new WorkspaceSettingItem(
                            'Focus Sidebar',
                            'Cmd+Shift+A (macOS) / Ctrl+Shift+A (Windows/Linux)',
                            undefined,
                            new vscode.ThemeIcon('keyboard')
                        )
                    ],
                    vscode.TreeItemCollapsibleState.Collapsed
                )
            ]);
        } else {
            // 子レベル: 親項目の子要素を返す
            return Promise.resolve(element.children || []);
        }
    }
}

export function deactivate() { }
