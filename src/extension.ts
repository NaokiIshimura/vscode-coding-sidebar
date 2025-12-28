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
import { TerminalService } from './services/TerminalService';

// テンプレートを読み込んで変数を置換する関数
function loadTemplate(context: vscode.ExtensionContext, variables: { [key: string]: string }): string {
    let templatePath: string;

    // 1. ワークスペースの.vscode/ai-coding-sidebar/templates/task.mdを優先
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
        const vscodeTemplatePath = path.join(workspaceRoot, '.vscode', 'ai-coding-sidebar', 'templates', 'task.md');
        if (fs.existsSync(vscodeTemplatePath)) {
            templatePath = vscodeTemplatePath;
        } else {
            // 2. 拡張機能内のtask.mdをフォールバック
            templatePath = path.join(context.extensionPath, 'templates', 'task.md');
        }
    } else {
        templatePath = path.join(context.extensionPath, 'templates', 'task.md');
    }

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
    }

    let content = fs.readFileSync(templatePath, 'utf8');

    // 変数を置換
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
async function setupTemplate(context: vscode.ExtensionContext, workspaceRoot: string): Promise<void> {
    const templatesDir = path.join(workspaceRoot, '.vscode', 'ai-coding-sidebar', 'templates');
    const templatePath = path.join(templatesDir, 'task.md');

    try {
        // .vscode/ai-coding-sidebar/templatesディレクトリを作成（存在しない場合）
        if (!fs.existsSync(templatesDir)) {
            fs.mkdirSync(templatesDir, { recursive: true });
        }

        // テンプレートファイルが存在しない場合のみ作成
        if (!fs.existsSync(templatePath)) {
            // 拡張機能内のtemplates/task.mdから読み込む
            const extensionTemplatePath = path.join(context.extensionPath, 'templates', 'task.md');
            if (!fs.existsSync(extensionTemplatePath)) {
                throw new Error(`Template file not found: ${extensionTemplatePath}`);
            }
            const templateContent = fs.readFileSync(extensionTemplatePath, 'utf8');
            fs.writeFileSync(templatePath, templateContent, 'utf8');
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
    console.log('AI Coding Panel activated');

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
    statusBarItem.text = "$(gear) AI Coding Panel Settings";
    statusBarItem.tooltip = "AI Coding Panel extension workspace settings";
    statusBarItem.command = "aiCodingSidebar.setupWorkspace";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // TreeDataProviderを作成
    const menuProvider = new MenuProvider();
    const tasksProvider = new TasksProvider(fileWatcherService);
    const editorProvider = new EditorProvider(context.extensionUri);

    // EditorProviderをTasksProviderに設定
    tasksProvider.setEditorProvider(editorProvider);
    // TasksProviderをEditorProviderに設定
    editorProvider.setDetailsProvider(tasksProvider);
    editorProvider.setTasksProvider(tasksProvider);

    // Terminal Providerを作成（EditorProviderに設定するため先に作成）
    const terminalProvider = new TerminalProvider(context.extensionUri);
    editorProvider.setTerminalProvider(terminalProvider);

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

        tasksProvider.setRootPath(targetPath, relativePath);
    };

    // ビューを登録
    const menuView = vscode.window.createTreeView('workspaceSettings', {
        treeDataProvider: menuProvider,
        showCollapseAll: false
    });

    const treeView = vscode.window.createTreeView('aiCodingSidebarExplorer', {
        treeDataProvider: tasksProvider,
        showCollapseAll: true,
        canSelectMany: false,
        dragAndDropController: tasksProvider
    });

    // TreeViewをProviderに設定
    tasksProvider.setTreeView(treeView);

    // 初期状態でリスナーを有効化
    tasksProvider.handleVisibilityChange(treeView.visible);

    // ビューの可視性変更を監視
    treeView.onDidChangeVisibility(() => {
        tasksProvider.handleVisibilityChange(treeView.visible);
    });

    // Markdown Editor Viewを登録
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            EditorProvider.viewType,
            editorProvider
        )
    );

    // Terminal Viewを登録
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TerminalProvider.viewType,
            terminalProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Terminal用のコマンドを登録
    context.subscriptions.push(
        vscode.commands.registerCommand('aiCodingSidebar.terminalNew', () => {
            terminalProvider.newTerminal();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiCodingSidebar.terminalClear', () => {
            terminalProvider.clearTerminal();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiCodingSidebar.terminalKill', () => {
            terminalProvider.killTerminal();
        })
    );

    // 初期化を実行
    initializeWithWorkspaceRoot();


    // 初期化後にルートフォルダを選択状態にする
    setTimeout(async () => {
        const currentRootPath = tasksProvider.getRootPath();
        if (currentRootPath) {
            await selectInitialFolder(treeView, currentRootPath);
        }
    }, 500);

    // フォルダ/ファイル選択時の処理
    treeView.onDidChangeSelection(async (e) => {
        if (e.selection.length > 0) {
            const selectedItem = e.selection[0];
            tasksProvider.setSelectedItem(selectedItem);

            // ファイルの場合（Markdownファイル）
            if (!selectedItem.isDirectory && selectedItem.filePath.endsWith('.md')) {
                // ファイル名がYYYY.MMDD.HHMM.SS_PROMPT.md形式の場合はMarkdown Editorで開く
                const fileName = path.basename(selectedItem.filePath);
                const timestampPattern = /^\d{4}\.\d{4}\.\d{4}\.\d{2}_PROMPT\.md$/;

                if (timestampPattern.test(fileName)) {
                    // YYYY.MMDD.HHMM.SS_PROMPT.md形式の場合はMarkdown Editorで開く
                    await editorProvider.showFile(selectedItem.filePath);
                } else {
                    // それ以外は通常のエディタで開く
                    const fileUri = vscode.Uri.file(selectedItem.filePath);
                    await vscode.commands.executeCommand('vscode.open', fileUri);
                }
            }
        }
    });

    // ビューを有効化
    vscode.commands.executeCommand('setContext', 'aiCodingSidebarView:enabled', true);

    // 更新コマンドを登録
    const refreshCommand = vscode.commands.registerCommand('aiCodingSidebar.refresh', () => {
        tasksProvider.refresh();
    });

    // 下ペイン表示コマンドを登録（互換性のために残す）
    const showInPanelCommand = vscode.commands.registerCommand('aiCodingSidebar.showInPanel', async (item: FileItem) => {
        if (item && item.isDirectory) {
            tasksProvider.setActiveFolder(item.filePath);
        }
    });

    // フォルダを開くコマンドを登録（互換性のために残す）
    const openFolderCommand = vscode.commands.registerCommand('aiCodingSidebar.openFolder', async (folderPath: string) => {
        tasksProvider.setActiveFolder(folderPath);
    });

    // 親フォルダへ移動するコマンドを登録
    const goToParentCommand = vscode.commands.registerCommand('aiCodingSidebar.goToParent', async () => {
        // フォルダツリーviewの親フォルダへ移動
        const currentPath = tasksProvider.getRootPath();
        if (currentPath) {
            const parentPath = path.dirname(currentPath);

            // プロジェクトルートより上には移動しない
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot && parentPath.startsWith(workspaceRoot) && parentPath !== currentPath) {
                tasksProvider.setRootPath(parentPath);
            } else {
                vscode.window.showInformationMessage('No parent folder available');
            }
        }
    });

    // 相対パス設定コマンドを登録
    const setRelativePathCommand = vscode.commands.registerCommand('aiCodingSidebar.setRelativePath', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const currentPath = tasksProvider.getRootPath() || workspaceRoot;

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
            tasksProvider.setRootPath(targetPath);

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

    // Tasks設定を開くコマンドを登録
    const openTasksSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openTasksSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:nacn.ai-coding-sidebar');
    });

    // Editor設定を開くコマンドを登録
    const openEditorSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openEditorSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodingSidebar.editor.runCommand');
    });

    // Terminal設定を開くコマンドを登録
    const openTerminalSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openTerminalSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodingSidebar.terminal');
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
                await setupTemplate(context, workspaceRoot);
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
        await setupTemplate(context, workspaceRoot);
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
        // 2. Tasks Viewで現在開いているフォルダ
        else {
            const currentPath = tasksProvider.getCurrentPath();
            if (!currentPath) {
                vscode.window.showErrorMessage('No folder is open');
                return;
            }
            targetPath = currentPath;
        }

        // 現在の日時を YYYY.MMDD.HHMM.SS 形式で取得
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');

        const timestamp = `${year}.${month}${day}.${hour}${minute}.${second}`;
        const fileName = `${timestamp}_PROMPT.md`;
        const filePath = path.join(targetPath, fileName);

        try {
            // テンプレートを使用してファイル内容を生成
            // ワークスペースルートからの相対パスを計算
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const relativeFilePath = workspaceRoot ? path.relative(workspaceRoot, filePath) : filePath;
            const relativeDirPath = workspaceRoot ? path.relative(workspaceRoot, targetPath) : targetPath;

            const variables = {
                datetime: now.toLocaleString(),
                filename: fileName,
                timestamp: timestamp,
                filepath: relativeFilePath,
                dirpath: relativeDirPath
            };

            const content = loadTemplate(context, variables);

            // FileOperationServiceを使用してファイル作成
            const result = await fileOperationService.createFile(filePath, content);

            if (result.success) {
                // ビューを更新
                tasksProvider.refresh();

                // 作成したファイルをMarkdown Editor Viewで開く
                await editorProvider.showFile(filePath);

                // Editor Viewにフォーカスを移動
                await vscode.commands.executeCommand('markdownEditor.focus');

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
            targetDirectory = tasksProvider.getCurrentPath()
                || tasksProvider.getRootPath()
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
                tasksProvider.refresh();

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
        // 2. Tasks Viewで現在開いているフォルダ
        else {
            const currentPath = tasksProvider.getCurrentPath();
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
            // FileOperationServiceを使用してフォルダ作成
            const result = await fileOperationService.createDirectory(folderPath);

            if (result.success) {
                // ビューを更新
                tasksProvider.refresh();

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
                tasksProvider.refresh();

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
                    const rootPath = tasksProvider.getRootPath();
                    if (rootPath) {
                        if (item.filePath === rootPath) {
                            tasksProvider.resetActiveFolder();
                            treeUpdated = true;
                        } else {
                            const parentPath = path.dirname(item.filePath);
                            if (parentPath && parentPath.startsWith(rootPath) && fs.existsSync(parentPath)) {
                                tasksProvider.setActiveFolder(parentPath, true);
                                treeUpdated = true;
                            } else {
                                tasksProvider.resetActiveFolder();
                                treeUpdated = true;
                            }
                        }
                    } else {
                        tasksProvider.resetActiveFolder();
                        treeUpdated = true;
                    }
                }

                if (!treeUpdated) {
                    tasksProvider.refresh();
                }

                vscode.window.showInformationMessage(`Deleted ${itemType} "${itemName}"`);
            } else {
                throw result[0].error || new Error('Failed to delete');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete: ${error}`);
        }
    });

    // フォルダを追加コマンドを登録（右クリックメニュー用）
    const addDirectoryCommand = vscode.commands.registerCommand('aiCodingSidebar.addDirectory', async (item?: FileItem) => {
        // directory listで選択されているディレクトリ配下にディレクトリを作成
        let targetItem = item;

        // itemが渡されていない場合は、現在選択されているアイテムを取得
        if (!targetItem) {
            targetItem = tasksProvider.getSelectedItem();
        }

        // 選択されたアイテムがディレクトリでない場合はルートパスを使用
        let targetPath: string;
        if (targetItem && targetItem.isDirectory) {
            targetPath = targetItem.filePath;
        } else {
            const currentPath = tasksProvider.getRootPath();
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
            tasksProvider.refresh();

            // 作成したディレクトリを選択状態にする
            await tasksProvider.revealDirectory(folderPath);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
        }
    });

    // 新しいディレクトリを作成してMarkdownファイルも作成するコマンド（タイトルメニュー用）
    const newDirectoryCommand = vscode.commands.registerCommand('aiCodingSidebar.newDirectory', async (item?: FileItem) => {
        // Tasks Viewで開いているディレクトリ配下にディレクトリを作成
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // 現在開いているディレクトリを取得、取得できない場合はdefaultRelativePathを使用
        const currentPath = tasksProvider.getCurrentPath();
        let targetPath: string;

        if (currentPath) {
            targetPath = currentPath;
        } else {
            const defaultRelativePath = configProvider.getDefaultRelativePath();
            if (!defaultRelativePath || defaultRelativePath.trim() === '') {
                vscode.window.showErrorMessage('Default relative path is not configured');
                return;
            }
            targetPath = path.join(workspaceRoot, defaultRelativePath);
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

            // 作成したディレクトリに移動
            tasksProvider.navigateToDirectory(folderPath);

            // 作成したディレクトリ内にMarkdownファイルを作成
            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const second = String(now.getSeconds()).padStart(2, '0');

            const timestamp = `${month}${day}.${hour}${minute}.${second}`;
            const fileName = `${timestamp}_PROMPT.md`;
            const filePath = path.join(folderPath, fileName);

            // テンプレートを使用してファイル内容を生成
            // ワークスペースルートからの相対パスを計算
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const relativeFilePath = workspaceRoot ? path.relative(workspaceRoot, filePath) : filePath;
            const relativeDirPath = workspaceRoot ? path.relative(workspaceRoot, folderPath) : folderPath;

            const variables = {
                datetime: now.toLocaleString(),
                filename: fileName,
                timestamp: timestamp,
                filepath: relativeFilePath,
                dirpath: relativeDirPath
            };

            const content = loadTemplate(context, variables);

            // FileOperationServiceを使用してファイル作成
            const result = await fileOperationService.createFile(filePath, content);

            if (result.success) {
                // ビューを更新してファイル一覧に新しいファイルを反映
                tasksProvider.refresh();

                // ビューの更新を待つ
                await new Promise(resolve => setTimeout(resolve, 300));

                // 作成したファイルをMarkdown Editor Viewで開く
                await editorProvider.showFile(filePath);

                vscode.window.showInformationMessage(`Created markdown file ${fileName} in "${trimmedFolderName}"`);
            } else {
                vscode.window.showWarningMessage(`Folder created but failed to create markdown file: ${result.error}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
        }
    });

    // ディレクトリ名変更コマンドを登録
    const renameDirectoryCommand = vscode.commands.registerCommand('aiCodingSidebar.renameDirectory', async (item?: FileItem) => {
        if (!item || !item.isDirectory) {
            vscode.window.showErrorMessage('No directory is selected');
            return;
        }

        await vscode.commands.executeCommand('aiCodingSidebar.rename', item);
    });

    // ディレクトリ削除コマンドを登録
    const deleteDirectoryCommand = vscode.commands.registerCommand('aiCodingSidebar.deleteDirectory', async (item?: FileItem) => {
        if (!item || !item.isDirectory) {
            vscode.window.showErrorMessage('No directory is selected');
            return;
        }

        await vscode.commands.executeCommand('aiCodingSidebar.delete', item);
    });

    // アーカイブコマンドを登録
    const archiveDirectoryCommand = vscode.commands.registerCommand('aiCodingSidebar.archiveDirectory', async (item?: FileItem) => {
        // 2.2 入力検証ロジック
        if (!item || !item.isDirectory) {
            vscode.window.showErrorMessage('選択されたアイテムはディレクトリではありません');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }

        const defaultRelativePath = configProvider.getDefaultRelativePath();
        if (!defaultRelativePath) {
            vscode.window.showErrorMessage('デフォルトタスクパスが設定されていません');
            return;
        }

        // 2.3 archivedディレクトリの作成ロジック
        const defaultTasksPath = path.join(workspaceRoot, defaultRelativePath);
        const archivedDirPath = path.join(defaultTasksPath, 'archived');
        const originalName = path.basename(item.filePath);

        try {
            if (!fs.existsSync(archivedDirPath)) {
                const result = await fileOperationService.createDirectory(archivedDirPath);
                if (!result.success) {
                    throw result.error || new Error('Failed to create archived directory');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`archivedディレクトリの作成に失敗しました: ${error}`);
            return;
        }

        // 2.4 名前競合チェックと移動先パス決定ロジック
        let destPath = path.join(archivedDirPath, originalName);
        let finalName = originalName;
        let hasConflict = false;

        if (fs.existsSync(destPath)) {
            hasConflict = true;
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const second = String(now.getSeconds()).padStart(2, '0');
            const timestamp = `${year}${month}${day}_${hour}${minute}${second}`;
            finalName = `${originalName}_${timestamp}`;
            destPath = path.join(archivedDirPath, finalName);
        }

        // 2.5 ディレクトリ移動とビュー更新
        try {
            const result = await fileOperationService.moveFile(item.filePath, destPath);
            if (!result.success) {
                throw result.error || new Error('Failed to move directory');
            }

            // ビューを更新
            tasksProvider.refresh();

            // 2.6 ユーザーフィードバック
            if (hasConflict) {
                vscode.window.showInformationMessage(
                    `ディレクトリをアーカイブしました（名前の競合により "${finalName}" に変更）`
                );
            } else {
                vscode.window.showInformationMessage(
                    `ディレクトリ "${originalName}" をアーカイブしました`
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`ディレクトリのアーカイブに失敗しました: ${error}`);
        }
    });

    // ブランチチェックアウトコマンドを登録
    const checkoutBranchCommand = vscode.commands.registerCommand('aiCodingSidebar.checkoutBranch', async (item?: FileItem) => {
        if (!item || !item.isDirectory) {
            vscode.window.showErrorMessage('No folder is selected');
            return;
        }

        // ディレクトリ名をブランチ名として使用
        const branchName = path.basename(item.filePath);

        // Git ブランチ名として不正な文字をチェック
        if (branchName.match(/[\s~^:?*\[\\]/)) {
            vscode.window.showErrorMessage(`Directory name "${branchName}" contains invalid characters for git branch name`);
            return;
        }

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
            const existingBranch = branches.find((branch: any) => branch.name === branchName);

            if (existingBranch) {
                // 既存のブランチにチェックアウト
                await repository.checkout(branchName);
                vscode.window.showInformationMessage(`Checked out branch "${branchName}"`);
            } else {
                // 新しいブランチを作成してチェックアウト
                await repository.createBranch(branchName, true);
                vscode.window.showInformationMessage(`Created and checked out branch "${branchName}"`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to checkout branch: ${error}`);
        }
    });

    // ターミナルを開くコマンドを登録
    const openTerminalCommand = vscode.commands.registerCommand('aiCodingSidebar.openTerminal', async () => {
        // VSCode内のターミナルを開く
        await vscode.commands.executeCommand('workbench.action.terminal.toggleTerminal');
        vscode.window.showInformationMessage('Terminal opened');
    });

    // デフォルトブランチにチェックアウトするコマンドを登録
    const checkoutDefaultBranchCommand = vscode.commands.registerCommand('aiCodingSidebar.checkoutDefaultBranch', async () => {
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

            // ローカルブランチの一覧を取得
            const branches = await repository.getBranches({ remote: false });

            // デフォルトブランチ候補（優先順位順）
            const defaultBranchCandidates = ['main', 'master', 'develop'];

            // 存在するブランチを探す
            let defaultBranch: string | undefined;
            for (const candidate of defaultBranchCandidates) {
                if (branches.find((branch: any) => branch.name === candidate)) {
                    defaultBranch = candidate;
                    break;
                }
            }

            if (!defaultBranch) {
                vscode.window.showErrorMessage('Default branch (main/master/develop) not found');
                return;
            }

            // デフォルトブランチにチェックアウト
            await repository.checkout(defaultBranch);
            vscode.window.showInformationMessage(`Checked out to default branch "${defaultBranch}"`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to checkout default branch: ${error}`);
        }
    });

    // Git pullコマンドを登録
    const gitPullCommand = vscode.commands.registerCommand('aiCodingSidebar.gitPull', async () => {
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

            // Git pull実行
            vscode.window.showInformationMessage('Pulling from remote...');
            await repository.pull();
            vscode.window.showInformationMessage('Successfully pulled from remote');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to pull: ${error}`);
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

    // エディタで開くコマンドを登録
    const openInEditorCommand = vscode.commands.registerCommand('aiCodingSidebar.openInEditor', async (item?: FileItem) => {
        if (!item) {
            vscode.window.showErrorMessage('No file is selected');
            return;
        }

        // ファイルの場合のみ開く
        if (!item.isDirectory) {
            const fileUri = vscode.Uri.file(item.filePath);
            await vscode.commands.executeCommand('vscode.open', fileUri);
        }
    });

    // Markdown Editorから相対パスをコピーするコマンドを登録
    const copyRelativePathFromEditorCommand = vscode.commands.registerCommand('aiCodingSidebar.copyRelativePathFromEditor', async () => {
        const currentFilePath = editorProvider.getCurrentFilePath();

        if (!currentFilePath) {
            vscode.window.showErrorMessage('No file is currently open in Markdown Editor');
            return;
        }

        // ワークスペースルートを取得
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // 相対パスを計算
        const relativePath = path.relative(workspaceRoot, currentFilePath);

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
            tasksProvider.setRootPath(targetPath, relativePath);

            // フォルダを選択状態にする
            setTimeout(async () => {
                await selectInitialFolder(treeView, targetPath);
            }, 300);

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create directory: ${error}`);
        }
    });

    // ディレクトリ移動コマンド（フラットリスト表示用）
    const navigateToDirectoryCommand = vscode.commands.registerCommand('aiCodingSidebar.navigateToDirectory', (targetPath: string) => {
        if (targetPath) {
            tasksProvider.navigateToDirectory(targetPath);
        }
    });

    // パスをEditorに挿入するコマンド（複数選択対応）
    const insertPathToEditorCommand = vscode.commands.registerCommand('aiCodingSidebar.insertPathToEditor', async (item?: FileItem, selectedItems?: FileItem[]) => {
        // 複数選択の場合はselectedItemsを使用、そうでなければitemを使用
        const items = selectedItems && selectedItems.length > 0 ? selectedItems : (item ? [item] : []);

        if (items.length === 0) {
            vscode.window.showErrorMessage('No file or folder is selected');
            return;
        }

        // ワークスペースルートを取得
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // 選択されたアイテムの相対パスを取得
        const relativePaths = items.map(i => path.relative(workspaceRoot, i.filePath));

        // Editorに挿入
        editorProvider.insertPaths(relativePaths);
    });

    // パスをTerminalに挿入するコマンド（複数選択対応）
    const insertPathToTerminalCommand = vscode.commands.registerCommand('aiCodingSidebar.insertPathToTerminal', async (item?: FileItem, selectedItems?: FileItem[]) => {
        // 複数選択の場合はselectedItemsを使用、そうでなければitemを使用
        const items = selectedItems && selectedItems.length > 0 ? selectedItems : (item ? [item] : []);

        if (items.length === 0) {
            vscode.window.showErrorMessage('No file or folder is selected');
            return;
        }

        // ワークスペースルートを取得
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // 選択されたアイテムの相対パスを取得
        const relativePaths = items.map(i => path.relative(workspaceRoot, i.filePath));

        // Terminalに挿入
        await terminalProvider.insertPaths(relativePaths);
    });

    context.subscriptions.push(refreshCommand, showInPanelCommand, openFolderCommand, goToParentCommand, setRelativePathCommand, openSettingsCommand, openTasksSettingsCommand, openEditorSettingsCommand, openTerminalSettingsCommand, setupWorkspaceCommand, openUserSettingsCommand, openWorkspaceSettingsCommand, setupTemplateCommand, createMarkdownFileCommand, createFileCommand, createFolderCommand, renameCommand, deleteCommand, addDirectoryCommand, newDirectoryCommand, renameDirectoryCommand, deleteDirectoryCommand, archiveDirectoryCommand, checkoutBranchCommand, openTerminalCommand, checkoutDefaultBranchCommand, gitPullCommand, copyRelativePathCommand, openInEditorCommand, copyRelativePathFromEditorCommand, createDefaultPathCommand, navigateToDirectoryCommand, insertPathToEditorCommand, insertPathToTerminalCommand);

    // プロバイダーのリソースクリーンアップを登録
    context.subscriptions.push({
        dispose: () => {
            tasksProvider.dispose();
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
                modified: stat.mtime,
                created: stat.birthtime
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
    created: Date;
}

// TreeDataProvider実装（フォルダのみ表示）
class TasksProvider implements vscode.TreeDataProvider<FileItem>, vscode.TreeDragAndDropController<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private rootPath: string | undefined;
    private projectRootPath: string | undefined;
    private treeView: vscode.TreeView<FileItem> | undefined;
    private selectedItem: FileItem | undefined;
    private itemCache: Map<string, FileItem[]> = new Map();  // パスをキーとしたFileItemのキャッシュ
    private activeFolderPath: string | undefined;
    private refreshDebounceTimer: NodeJS.Timeout | undefined;
    private readonly listenerId = 'ai-coding-sidebar';
    private fileWatcherService: FileWatcherService | undefined;
    private pathNotFound: boolean = false;
    private configuredRelativePath: string | undefined;
    private _isInitialLoad: boolean = true;
    private editorProvider: EditorProvider | undefined;
    private configChangeDisposable: vscode.Disposable | undefined;

    // Drag & Drop support
    readonly dragMimeTypes = ['application/vnd.code.tree.aiCodingSidebarExplorer'];
    readonly dropMimeTypes = ['application/vnd.code.tree.aiCodingSidebarExplorer', 'text/uri-list'];

    constructor(fileWatcherService?: FileWatcherService) {
        this.fileWatcherService = fileWatcherService;
        // プロジェクトルートパスを取得
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.projectRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        // リスナーを事前に登録
        if (this.fileWatcherService) {
            this.fileWatcherService.registerListener(this.listenerId, (uri) => {
                this.debouncedRefresh(uri.fsPath);
            });
        }
        // 設定変更を監視してタイトルと表示を更新
        this.configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('aiCodingSidebar.markdownList.sortBy') ||
                e.affectsConfiguration('aiCodingSidebar.markdownList.sortOrder')) {
                this.refresh();
            }
        });
    }

    setEditorProvider(provider: EditorProvider): void {
        this.editorProvider = provider;
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
        // リスナーはコンストラクタで登録済み
        // この関数は互換性のために残す
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
        if (this.configChangeDisposable) {
            this.configChangeDisposable.dispose();
            this.configChangeDisposable = undefined;
        }
    }

    private updateTitle(): void {
        if (this.treeView) {
            // タイトルは「TASKS」固定
            this.treeView.title = 'TASKS';
        }
    }

    getCurrentPath(): string | undefined {
        return this.activeFolderPath || this.rootPath;
    }

    /**
     * Tasks Viewで指定されたファイルを選択状態にする
     */
    async revealFile(filePath: string): Promise<void> {
        if (!this.treeView || !this.rootPath) {
            return;
        }

        try {
            // ファイルが存在するか確認
            if (!fs.existsSync(filePath)) {
                return;
            }

            // ファイルが現在のrootPath配下にあるか確認
            if (!filePath.startsWith(this.rootPath)) {
                return;
            }

            const parentDir = path.dirname(filePath);
            // キャッシュから該当するFileItemを探す
            let fileItems = this.itemCache.get(parentDir);

            // キャッシュになければ、getChildrenを呼んで取得
            if (!fileItems) {
                const parentItem = new FileItem(
                    path.basename(parentDir),
                    vscode.TreeItemCollapsibleState.Expanded,
                    parentDir,
                    true,
                    0,
                    new Date()
                );
                await this.getChildren(parentItem);
                fileItems = this.itemCache.get(parentDir);
            }

            if (!fileItems) {
                return;
            }

            // ファイルパスが一致するFileItemを探す
            const fileItem = fileItems.find(item => item.filePath === filePath);

            if (!fileItem) {
                return;
            }

            // ファイルを選択状態にする（focus: falseで他のビューへの影響を最小化）
            await this.treeView.reveal(fileItem, { select: true, focus: false, expand: false });
        } catch (error) {
            console.error('Failed to reveal file:', error);
        }
    }

    // Drag & Drop handlers
    handleDrag(source: readonly FileItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        dataTransfer.set('application/vnd.code.tree.aiCodingSidebarExplorer', new vscode.DataTransferItem(source));
    }

    handleDrop(target: FileItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        // ターゲットディレクトリの決定
        let targetDir: string;
        if (!target) {
            // ビューのルートにドロップされた場合は、現在開いているフォルダを使用
            targetDir = this.activeFolderPath || this.rootPath!;
        } else if (target.isDirectory) {
            // フォルダにドロップされた場合
            targetDir = target.filePath;
        } else {
            // ファイルにドロップされた場合は、その親ディレクトリにコピー
            targetDir = path.dirname(target.filePath);
        }

        // 外部からのファイルドロップをチェック（text/uri-list）
        const uriListItem = dataTransfer.get('text/uri-list');
        if (uriListItem) {
            uriListItem.asString().then(uriList => {
                const uris = uriList.split('\n').filter(uri => uri.trim() !== '');
                this.copyExternalFiles(uris, targetDir);
            });
            return;
        }

        // ツリービュー内からのドラッグ&ドロップ
        const transferItem = dataTransfer.get('application/vnd.code.tree.aiCodingSidebarExplorer');
        if (!transferItem) {
            return;
        }

        const sourceItems = transferItem.value as readonly FileItem[];
        if (!sourceItems || sourceItems.length === 0) {
            return;
        }

        // ファイルのコピー処理
        this.copyFiles(sourceItems, targetDir);
    }

    /**
     * 外部からドロップされたファイルをコピー
     */
    private async copyExternalFiles(uris: string[], targetDir: string): Promise<void> {
        const copiedFiles: string[] = [];

        for (const uriStr of uris) {
            try {
                const uri = vscode.Uri.parse(uriStr);
                if (uri.scheme !== 'file') {
                    continue;
                }

                const sourcePath = uri.fsPath;
                const fileName = path.basename(sourcePath);
                const targetPath = path.join(targetDir, fileName);

                // 同じパスへのコピーは無視
                if (sourcePath === targetPath) {
                    continue;
                }

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

                // ファイルをコピー
                fs.copyFileSync(sourcePath, targetPath);
                copiedFiles.push(fileName);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to copy file: ${error}`);
            }
        }

        // コピー成功メッセージを表示
        if (copiedFiles.length > 0) {
            const message = copiedFiles.length === 1
                ? `Copied: ${copiedFiles[0]}`
                : `Copied ${copiedFiles.length} files`;
            vscode.window.showInformationMessage(message);
        }

        // ビューを更新
        this.refresh();
    }

    /**
     * ツリービュー内のファイルをコピー
     */
    private async copyFiles(sourceItems: readonly FileItem[], targetDir: string): Promise<void> {
        const copiedFiles: string[] = [];

        for (const item of sourceItems) {
            const sourcePath = item.filePath;
            const fileName = path.basename(sourcePath);
            const targetPath = path.join(targetDir, fileName);

            // 同じパスへのコピーは無視
            if (sourcePath === targetPath) {
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

                // ファイルをコピー
                fs.copyFileSync(sourcePath, targetPath);
                copiedFiles.push(fileName);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to copy ${fileName}: ${error}`);
            }
        }

        // コピー成功メッセージを表示
        if (copiedFiles.length > 0) {
            const message = copiedFiles.length === 1
                ? `Copied: ${copiedFiles[0]}`
                : `Copied ${copiedFiles.length} files`;
            vscode.window.showInformationMessage(message);
        }

        // ビューを更新
        this.refresh();
    }

    getRootPath(): string | undefined {
        return this.rootPath;
    }

    setSelectedItem(item: FileItem | undefined): void {
        this.selectedItem = item;
    }

    getSelectedItem(): FileItem | undefined {
        return this.selectedItem;
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

    async getChildren(element?: FileItem): Promise<FileItem[]> {
        // フラットリスト表示のため、elementは常にundefined
        // 子要素として呼ばれた場合は空を返す（ツリー展開しない）
        if (element) {
            return [];
        }

        // Show loader on initial load
        if (this._isInitialLoad) {
            this._isInitialLoad = false;
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (!this.rootPath) {
            return [];
        }

        // パスが存在しない場合は、作成ボタンを表示
        if (this.pathNotFound) {
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
            return [createButton];
        }

        // 現在表示するディレクトリパス
        const currentPath = this.activeFolderPath || this.rootPath;
        const items: FileItem[] = [];

        // パス表示アイテム（最上部に表示）
        // ルートディレクトリの場合のみプロジェクトルートからのパスを表示
        let displayPath: string;
        if (currentPath === this.rootPath && this.projectRootPath) {
            displayPath = path.relative(this.projectRootPath, this.rootPath);
        } else {
            displayPath = path.relative(this.rootPath, currentPath);
        }
        const pathItem = new FileItem(
            displayPath || '.',
            vscode.TreeItemCollapsibleState.None,
            currentPath,
            true,
            0,
            new Date()
        );
        pathItem.contextValue = 'pathDisplay';
        pathItem.iconPath = new vscode.ThemeIcon('folder-opened');
        pathItem.tooltip = currentPath;
        items.push(pathItem);

        // 親ディレクトリへ戻るアイテム（ルートより上には戻れない）
        if (currentPath !== this.rootPath) {
            const parentPath = path.dirname(currentPath);
            const parentItem = new FileItem(
                '..',
                vscode.TreeItemCollapsibleState.None,
                parentPath,
                true,
                0,
                new Date()
            );
            parentItem.contextValue = 'parentDirectory';
            parentItem.iconPath = new vscode.ThemeIcon('arrow-up');
            parentItem.command = {
                command: 'aiCodingSidebar.navigateToDirectory',
                title: 'Go to Parent Directory',
                arguments: [parentPath]
            };
            parentItem.tooltip = 'Go to parent directory';
            items.push(parentItem);
        }

        // キャッシュに存在する場合は返す
        if (this.itemCache.has(currentPath)) {
            const cachedItems = this.itemCache.get(currentPath)!;
            return [...items, ...cachedItems];
        }

        try {
            const files = this.getFilesInDirectory(currentPath);
            const currentFilePath = this.editorProvider?.getCurrentFilePath();
            const fileItems = files.map(file => {
                const isDirectory = file.isDirectory;
                // フラットリスト表示のため、すべてCollapsibleState.None
                const item = new FileItem(
                    file.name,
                    vscode.TreeItemCollapsibleState.None,
                    file.path,
                    isDirectory,
                    file.size,
                    file.modified
                );

                // ディレクトリの場合、クリックでディレクトリ移動
                if (isDirectory) {
                    item.command = {
                        command: 'aiCodingSidebar.navigateToDirectory',
                        title: 'Navigate to Directory',
                        arguments: [file.path]
                    };
                } else {
                    // 現在Markdown Editorで編集中のファイルに「editing」表記を追加し、ファイル名を太字で表示
                    if (currentFilePath && file.path === currentFilePath) {
                        item.description = 'editing';
                        // TreeItemLabelのhighlightsを使用してファイル名全体を太字にする
                        (item as vscode.TreeItem).label = {
                            label: file.name,
                            highlights: [[0, file.name.length]]
                        };
                    }
                }

                return item;
            });

            // キャッシュに保存
            this.itemCache.set(currentPath, fileItems);
            return [...items, ...fileItems];
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read directory: ${error}`);
            return items;
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

    /**
     * 指定されたディレクトリに移動する（フラットリスト表示用）
     */
    navigateToDirectory(targetPath: string): void {
        if (!targetPath || !fs.existsSync(targetPath)) {
            return;
        }

        // rootPath の範囲内かチェック
        if (this.rootPath && !targetPath.startsWith(this.rootPath)) {
            return;
        }

        this.activeFolderPath = targetPath;
        this.updateTitle();
        this.refresh();
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

    async revealDirectory(directoryPath: string): Promise<void> {
        if (!this.treeView) {
            return;
        }

        try {
            const stat = fs.statSync(directoryPath);
            if (!stat.isDirectory()) {
                return;
            }

            const item = new FileItem(
                path.basename(directoryPath),
                vscode.TreeItemCollapsibleState.Collapsed,
                directoryPath,
                true,
                0,
                stat.mtime
            );

            await this.treeView.reveal(item, { select: true, focus: false, expand: false });
        } catch (error) {
            console.error('Failed to reveal directory:', error);
        }
    }

    private getFilesInDirectory(dirPath: string): FileInfo[] {
        const directories: FileInfo[] = [];
        const files: FileInfo[] = [];

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const stat = fs.statSync(fullPath);

                if (entry.isDirectory()) {
                    directories.push({
                        name: entry.name,
                        path: fullPath,
                        isDirectory: true,
                        size: 0,
                        modified: stat.mtime,
                        created: stat.birthtime
                    });
                } else {
                    files.push({
                        name: entry.name,
                        path: fullPath,
                        isDirectory: false,
                        size: stat.size,
                        modified: stat.mtime,
                        created: stat.birthtime
                    });
                }
            }

            // ディレクトリを名前順でソート
            directories.sort((a, b) => a.name.localeCompare(b.name));

            // ファイルをソート設定に基づいてソート
            const config = vscode.workspace.getConfiguration('aiCodingSidebar.markdownList');
            const sortBy = config.get<string>('sortBy', 'created');
            const sortOrder = config.get<string>('sortOrder', 'ascending');

            files.sort((a, b) => {
                let comparison = 0;

                switch (sortBy) {
                    case 'name':
                        comparison = a.name.localeCompare(b.name);
                        break;
                    case 'created':
                        comparison = a.created.getTime() - b.created.getTime();
                        break;
                    case 'modified':
                        comparison = a.modified.getTime() - b.modified.getTime();
                        break;
                    default:
                        comparison = a.created.getTime() - b.created.getTime();
                }

                return sortOrder === 'descending' ? -comparison : comparison;
            });

            // ディレクトリを先に、その後ファイルを返す
            return [...directories, ...files];

        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err && err.code === 'ENOENT') {
                return [];
            }

            const message = err && err.message ? err.message : String(error);
            throw new Error(`Failed to read directory: ${message}`);
        }
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

        // ファイルの場合はクリックで開く（Markdownファイル以外）
        // Markdownファイルは Markdown Editor で開くため、vscode.open コマンドを設定しない
        if (!isDirectory && !label.endsWith('.md')) {
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

        // Markdownファイルの場合、タイムスタンプ形式かどうかで分ける
        if (ext === '.md') {
            const timestampPattern = /^\d{4}\.\d{4}\.\d{2}_PROMPT\.md$/;
            // タイムスタンプ形式の場合はeditアイコン（Markdown Editorで開く）
            if (timestampPattern.test(fileName)) {
                return new vscode.ThemeIcon('edit');
            }
            // それ以外はmarkdownアイコン（通常のエディタで開く）
            return new vscode.ThemeIcon('markdown');
        }

        // 拡張子に応じてアイコンを選択
        const iconMap: { [key: string]: string } = {
            '.ts': 'symbol-method',
            '.tsx': 'symbol-method',
            '.js': 'symbol-function',
            '.jsx': 'symbol-function',
            '.json': 'json',
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

// ワークスペース設定アイテムクラス
class MenuItem extends vscode.TreeItem {
    public readonly children?: MenuItem[];

    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly command: vscode.Command | undefined,
        public readonly iconPath: vscode.ThemeIcon,
        children?: MenuItem[],
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

// Menu provider
class MenuProvider implements vscode.TreeDataProvider<MenuItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MenuItem | undefined | null | void> = new vscode.EventEmitter<MenuItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MenuItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private _isInitialLoad: boolean = true;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MenuItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: MenuItem): Promise<MenuItem[]> {
        // Show loader on initial load
        if (this._isInitialLoad && !element) {
            this._isInitialLoad = false;
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (!element) {
            // ルートレベル: メニュー項目を返す
            return [
                // グローバル（親項目）
                new MenuItem(
                    'Global',
                    'User-level settings',
                    undefined,
                    new vscode.ThemeIcon('account'),
                    [
                        new MenuItem(
                            'Open User Settings',
                            'Open AI Coding Panel user settings',
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
                new MenuItem(
                    'Workspace',
                    'Workspace-level settings',
                    undefined,
                    new vscode.ThemeIcon('folder-opened'),
                    [
                        new MenuItem(
                            'Open Workspace Settings',
                            'Open AI Coding Panel workspace settings',
                            {
                                command: 'aiCodingSidebar.openWorkspaceSettings',
                                title: 'Open Workspace Settings'
                            },
                            new vscode.ThemeIcon('settings-gear')
                        ),
                        new MenuItem(
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
                // Shortcut（親項目）
                new MenuItem(
                    'Shortcut',
                    'Quick actions and shortcuts',
                    undefined,
                    new vscode.ThemeIcon('zap'),
                    [
                        new MenuItem(
                            'Open Terminal',
                            'Open integrated terminal in VSCode',
                            {
                                command: 'aiCodingSidebar.openTerminal',
                                title: 'Open Terminal'
                            },
                            new vscode.ThemeIcon('terminal')
                        ),
                        new MenuItem(
                            'Checkout Default Branch',
                            'Switch to the default branch (main/master)',
                            {
                                command: 'aiCodingSidebar.checkoutDefaultBranch',
                                title: 'Checkout Default Branch'
                            },
                            new vscode.ThemeIcon('git-branch')
                        ),
                        new MenuItem(
                            'Git Pull',
                            'Pull the latest changes from remote',
                            {
                                command: 'aiCodingSidebar.gitPull',
                                title: 'Git Pull'
                            },
                            new vscode.ThemeIcon('arrow-down')
                        ),
                        new MenuItem(
                            'Duplicate Workspace in New Window',
                            'Open a copy of this workspace in a new window',
                            {
                                command: 'workbench.action.duplicateWorkspaceInNewWindow',
                                title: 'Duplicate Workspace in New Window'
                            },
                            new vscode.ThemeIcon('multiple-windows')
                        )
                    ],
                    vscode.TreeItemCollapsibleState.Collapsed
                ),
                // Note（親項目）
                new MenuItem(
                    'Note',
                    'Keyboard shortcuts and tips',
                    undefined,
                    new vscode.ThemeIcon('info'),
                    [
                        new MenuItem(
                            'Focus Sidebar',
                            'Cmd+Shift+A (macOS) / Ctrl+Shift+A (Windows/Linux)',
                            undefined,
                            new vscode.ThemeIcon('keyboard')
                        ),
                        new MenuItem(
                            'New Task',
                            'Cmd+S (macOS) / Ctrl+S (Windows/Linux) - When sidebar is focused',
                            undefined,
                            new vscode.ThemeIcon('keyboard')
                        ),
                        new MenuItem(
                            'Create Markdown File',
                            'Cmd+M (macOS) / Ctrl+M (Windows/Linux) - When sidebar is focused',
                            undefined,
                            new vscode.ThemeIcon('keyboard')
                        )
                    ],
                    vscode.TreeItemCollapsibleState.Collapsed
                )
            ];
        } else {
            // 子レベル: 親項目の子要素を返す
            return element.children || [];
        }
    }
}

// Markdown Editor Provider
class EditorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'markdownEditor';
    private _view?: vscode.WebviewView;
    private _currentFilePath?: string;
    private _currentContent?: string;
    private _pendingContent?: string;
    private _isDirty: boolean = false;
    private _detailsProvider?: TasksProvider;
    private _tasksProvider?: TasksProvider;
    private _terminalProvider?: TerminalProvider;
    private _pendingFileToRestore?: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {
        // アクティブエディタの変更を監視
        vscode.window.onDidChangeActiveTextEditor(editor => {
            this._checkAndUpdateReadOnlyState(editor);
        });
    }

    private _checkAndUpdateReadOnlyState(editor: vscode.TextEditor | undefined) {
        if (!this._view || !this._currentFilePath) {
            return;
        }

        // アクティブなエディタがMarkdown Editorで開いているファイルと同じかチェック
        const isActiveInEditor = editor && editor.document.uri.fsPath === this._currentFilePath;

        // webviewに読み取り専用状態を更新
        this._view.webview.postMessage({
            type: 'setReadOnlyState',
            isReadOnly: !!isActiveInEditor
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Webviewからのメッセージを受信
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'webviewReady':
                    // Webviewの準備が完了したら、保留中のファイルを復元
                    if (this._pendingFileToRestore) {
                        await this.showFile(this._pendingFileToRestore);
                        this._pendingFileToRestore = undefined;
                    }
                    break;
                case 'save':
                    if (this._currentFilePath) {
                        // 優先度1: 既存ファイルへの上書き保存
                        try {
                            await fs.promises.writeFile(this._currentFilePath, data.content, 'utf8');
                            vscode.window.showInformationMessage('File saved successfully');
                            this._currentContent = data.content;
                            this._pendingContent = undefined;
                            this._isDirty = false;
                            // 保存後に未保存状態をクリア
                            this._view?.webview.postMessage({
                                type: 'updateDirtyState',
                                isDirty: false
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to save file: ${error}`);
                        }
                    } else if (data.content && data.content.trim()) {
                        // ファイル未開時 - 新規ファイルとして保存
                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        if (!workspaceRoot) {
                            vscode.window.showErrorMessage('No workspace folder is open');
                            break;
                        }

                        let savePath: string;

                        // 優先度2: Docs viewで開いているディレクトリ
                        const docsCurrentPath = this._detailsProvider?.getCurrentPath();
                        // 優先度3: Tasks viewで選択しているディレクトリ
                        const tasksRootPath = this._tasksProvider?.getRootPath();

                        if (docsCurrentPath) {
                            savePath = docsCurrentPath;
                        } else if (tasksRootPath) {
                            savePath = tasksRootPath;
                        } else {
                            // 優先度4: デフォルトパス
                            const config = vscode.workspace.getConfiguration('aiCodingSidebar');
                            const defaultRelativePath = config.get<string>('defaultRelativePath', '.claude/tasks');
                            savePath = path.join(workspaceRoot, defaultRelativePath);
                        }

                        // ディレクトリが存在しない場合は作成
                        await fs.promises.mkdir(savePath, { recursive: true });

                        // タイムスタンプ付きファイル名を生成 (YYYY.MMDD.HHMM.SS形式)
                        const now = new Date();
                        const year = String(now.getFullYear());
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const hour = String(now.getHours()).padStart(2, '0');
                        const minute = String(now.getMinutes()).padStart(2, '0');
                        const second = String(now.getSeconds()).padStart(2, '0');
                        const timestamp = `${year}.${month}${day}.${hour}${minute}.${second}`;

                        const fileName = `${timestamp}_PROMPT.md`;
                        const filePath = path.join(savePath, fileName);

                        try {
                            await fs.promises.writeFile(filePath, data.content, 'utf8');
                            vscode.window.showInformationMessage(`File saved: ${fileName}`);

                            // 保存したファイルをエディタで開く
                            this._currentFilePath = filePath;
                            this._currentContent = data.content;
                            this._pendingContent = undefined;
                            this._isDirty = false;

                            // ファイルパスをWebviewに反映（ファイル名のみ表示）
                            const displayPath = path.basename(filePath);
                            this._view?.webview.postMessage({
                                type: 'showContent',
                                content: data.content,
                                filePath: displayPath,
                                isReadOnly: false
                            });

                            // ツリービューを更新
                            this._tasksProvider?.refresh();
                            this._detailsProvider?.refresh();

                            // 保存したディレクトリに移動してファイルを選択
                            setTimeout(async () => {
                                // Tasks viewでディレクトリを表示
                                await this._tasksProvider?.revealDirectory(savePath);
                                // Tasks viewでファイルを選択
                                // アクティブフォルダが異なる場合は更新が必要
                                const currentActivePath = this._detailsProvider?.getCurrentPath();
                                if (currentActivePath !== savePath) {
                                    // アクティブフォルダを変更
                                    this._detailsProvider?.setActiveFolder(savePath);
                                    // ファイルを再度開く
                                    await this.showFile(filePath);
                                }
                                await this._detailsProvider?.revealFile(filePath);
                            }, 100);
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to save file: ${error}`);
                        }
                    } else {
                        vscode.window.showWarningMessage('Please enter some text before saving.');
                    }
                    break;
                case 'contentChanged':
                    // エディタの内容が変更された
                    this._pendingContent = data.content;
                    const isDirty = data.content !== this._currentContent;
                    if (this._isDirty !== isDirty) {
                        this._isDirty = isDirty;
                    }
                    break;
                case 'createMarkdownFile':
                    // Cmd+M / Ctrl+M pressed - execute create markdown file command
                    vscode.commands.executeCommand('aiCodingSidebar.createMarkdownFile');
                    break;
                case 'runTask':
                    // Run button clicked - save file if needed, then send command to terminal
                    if (this._currentFilePath) {
                        // Save file first if content is provided
                        if (data.content) {
                            try {
                                await fs.promises.writeFile(this._currentFilePath, data.content, 'utf8');
                                this._currentContent = data.content;
                                this._pendingContent = undefined;
                                this._isDirty = false;
                                // Update dirty state in webview
                                this._view?.webview.postMessage({
                                    type: 'updateDirtyState',
                                    isDirty: false
                                });
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to save file: ${error}`);
                                return;
                            }
                        }

                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        let relativeFilePath: string;

                        if (workspaceRoot) {
                            // Calculate relative path from workspace root
                            relativeFilePath = path.relative(workspaceRoot, this._currentFilePath);
                        } else {
                            // If no workspace, use the full path
                            relativeFilePath = this._currentFilePath;
                        }

                        // Get the run command template from settings
                        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
                        const commandTemplate = config.get<string>('editor.runCommand', 'claude "${filePath}"');

                        // Replace ${filePath} placeholder with actual file path
                        const command = commandTemplate.replace(/\$\{filePath\}/g, relativeFilePath.trim());

                        // Send command to Terminal view
                        if (this._terminalProvider) {
                            this._terminalProvider.focus();
                            await this._terminalProvider.sendCommand(command);
                        }
                    } else if (data.editorContent && data.editorContent.trim()) {
                        // No file open - use the editor content directly
                        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
                        const commandTemplate = config.get<string>('editor.runCommandWithoutFile', 'claude "${editorContent}"');

                        // Replace ${editorContent} placeholder with actual editor content
                        // Escape double quotes in editor content to prevent command injection
                        const escapedContent = data.editorContent.trim().replace(/"/g, '\\"');
                        const command = commandTemplate.replace(/\$\{editorContent\}/g, escapedContent);

                        // Send command to Terminal view
                        if (this._terminalProvider) {
                            this._terminalProvider.focus();
                            await this._terminalProvider.sendCommand(command);
                        }
                    } else {
                        vscode.window.showWarningMessage('Please enter some text in the editor to run a task.');
                    }
                    break;
            }
        });

        // Restore previously opened file if exists
        // Store file path to restore after webview is ready
        if (this._currentFilePath) {
            this._pendingFileToRestore = this._currentFilePath;
        }

        // Listen to visibility changes
        webviewView.onDidChangeVisibility(async () => {
            if (webviewView.visible && this._currentFilePath) {
                // Restore current file when view becomes visible
                try {
                    // Re-read the file content to ensure we have the latest version
                    const content = await fs.promises.readFile(this._currentFilePath, 'utf8');
                    this._currentContent = content;
                    this._pendingContent = undefined;
                    this._isDirty = false;

                    const displayPath = path.basename(this._currentFilePath);
                    const isActiveInEditor = vscode.window.activeTextEditor?.document.uri.fsPath === this._currentFilePath;

                    this._view?.webview.postMessage({
                        type: 'showContent',
                        filePath: displayPath,
                        content: content,
                        isReadOnly: isActiveInEditor
                    });
                } catch (error) {
                    console.error(`Failed to restore file: ${error}`);
                }
            } else if (!webviewView.visible && this._currentFilePath && this._isDirty && this._pendingContent) {
                // Save changes when view becomes hidden
                try {
                    await fs.promises.writeFile(this._currentFilePath, this._pendingContent, 'utf8');
                    this._currentContent = this._pendingContent;
                    this._isDirty = false;
                } catch (error) {
                    console.error(`Failed to auto-save file: ${error}`);
                }
            }
        });
    }

    public async showFile(filePath: string) {
        // Save current file if it has unsaved changes before switching
        if (this._currentFilePath && this._isDirty && this._pendingContent && this._currentFilePath !== filePath) {
            try {
                await fs.promises.writeFile(this._currentFilePath, this._pendingContent, 'utf8');
                this._currentContent = this._pendingContent;
                this._isDirty = false;
            } catch (error) {
                console.error(`Failed to auto-save file before switching: ${error}`);
            }
        }

        this._currentFilePath = filePath;

        // アクティブなエディタがこのファイルかチェック
        const isActiveInEditor = vscode.window.activeTextEditor?.document.uri.fsPath === filePath;

        if (isActiveInEditor) {
            vscode.window.showWarningMessage('This file is active in the editor. Markdown Editor will be read-only.');
        }

        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            this._currentContent = content;
            this._pendingContent = undefined;
            this._isDirty = false;

            // ファイル名のみを表示
            const displayPath = path.basename(filePath);

            if (this._view) {
                this._view.webview.postMessage({
                    type: 'showContent',
                    filePath: displayPath,
                    content: content,
                    isReadOnly: isActiveInEditor
                });
                this._view.show?.(true);
            }

            // Markdown Listをリフレッシュして「editing」表記を更新
            if (this._detailsProvider) {
                this._detailsProvider.refresh();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read file: ${error}`);
        }
    }

    public getCurrentFilePath(): string | undefined {
        return this._currentFilePath;
    }

    public setDetailsProvider(provider: TasksProvider): void {
        this._detailsProvider = provider;
    }

    public setTasksProvider(provider: TasksProvider): void {
        this._tasksProvider = provider;
    }

    public setTerminalProvider(provider: TerminalProvider): void {
        this._terminalProvider = provider;
    }

    public clearFile(): void {
        this._currentFilePath = undefined;
        this._currentContent = undefined;
        this._pendingContent = undefined;
        this._isDirty = false;

        if (this._view) {
            this._view.webview.postMessage({
                type: 'clearContent'
            });
        }
    }

    /**
     * 複数のパスをエディタに挿入
     * @param paths 挿入するパスの配列
     */
    public insertPaths(paths: string[]): void {
        if (!this._view) {
            vscode.window.showWarningMessage('Editor view is not available');
            return;
        }

        const pathText = paths.join('\n');
        this._view.webview.postMessage({
            type: 'insertText',
            text: pathText
        });

        // Editorビューをフォーカス
        this._view.show?.(true);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Editor</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        #header {
            padding: 8px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .file-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .run-button {
            padding: 2px 8px;
            font-size: 11px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        .run-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .run-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .save-button {
            padding: 2px 8px;
            font-size: 11px;
            background-color: transparent;
            color: var(--vscode-foreground);
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 2px;
            cursor: pointer;
        }
        .save-button:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }
        .save-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .save-button.dirty {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
        }
        .save-button.dirty:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .readonly-indicator {
            font-size: 11px;
            color: var(--vscode-editorWarning-foreground);
            display: none;
        }
        .readonly-indicator.show {
            display: inline;
        }
        #editor-container {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        #editor {
            flex: 1;
            width: 100%;
            border: none;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            resize: none;
            padding: 10px;
            box-sizing: border-box;
        }
        #editor:focus {
            outline: none;
        }
        #editor[readonly] {
            background-color: var(--vscode-input-background);
            opacity: 0.8;
            cursor: not-allowed;
        }
        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div id="header">
        <div class="file-info">
            <span id="file-path"></span>
        </div>
        <div class="header-actions">
            <span class="readonly-indicator" id="readonly-indicator">Read-only</span>
            <button class="save-button" id="save-button" title="Save file">Save</button>
            <button class="run-button" id="run-button" title="Run task (Cmd+R / Ctrl+R)">Run</button>
        </div>
    </div>
    <div id="editor-container">
        <textarea id="editor" placeholder="Shortcuts:
  Cmd+M / Ctrl+M - Create new markdown file
  Cmd+R / Ctrl+R - Run task"></textarea>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const editor = document.getElementById('editor');
        const filePathElement = document.getElementById('file-path');
        const readonlyIndicator = document.getElementById('readonly-indicator');
        const saveButton = document.getElementById('save-button');
        const runButton = document.getElementById('run-button');
        let originalContent = '';
        let currentFilePath = '';
        let isReadOnly = false;

        // メッセージを受信
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'showContent':
                    editor.value = message.content;
                    originalContent = message.content;
                    currentFilePath = message.filePath;
                    filePathElement.textContent = message.filePath;
                    saveButton.classList.remove('dirty');

                    // Handle read-only mode
                    isReadOnly = message.isReadOnly || false;
                    if (isReadOnly) {
                        editor.setAttribute('readonly', 'readonly');
                        readonlyIndicator.classList.add('show');
                    } else {
                        editor.removeAttribute('readonly');
                        readonlyIndicator.classList.remove('show');
                    }
                    break;
                case 'updateDirtyState':
                    if (message.isDirty) {
                        saveButton.classList.add('dirty');
                    } else {
                        saveButton.classList.remove('dirty');
                        originalContent = editor.value;
                    }
                    break;
                case 'setReadOnlyState':
                    isReadOnly = message.isReadOnly || false;
                    if (isReadOnly) {
                        editor.setAttribute('readonly', 'readonly');
                        readonlyIndicator.classList.add('show');
                        saveButton.classList.remove('dirty');
                    } else {
                        editor.removeAttribute('readonly');
                        readonlyIndicator.classList.remove('show');
                        // Check if content is dirty when switching back to editable
                        const isDirty = editor.value !== originalContent;
                        if (isDirty) {
                            saveButton.classList.add('dirty');
                        }
                    }
                    break;
                case 'clearContent':
                    editor.value = '';
                    originalContent = '';
                    currentFilePath = '';
                    filePathElement.textContent = '';
                    saveButton.classList.remove('dirty');
                    readonlyIndicator.classList.remove('show');
                    editor.removeAttribute('readonly');
                    isReadOnly = false;
                    break;
                case 'insertText':
                    // カーソル位置にテキストを挿入
                    const start = editor.selectionStart;
                    const end = editor.selectionEnd;
                    const text = message.text;
                    editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
                    // カーソルを挿入テキストの後に移動
                    editor.selectionStart = editor.selectionEnd = start + text.length;
                    editor.focus();
                    // 変更を通知
                    vscode.postMessage({ type: 'contentChanged', content: editor.value });
                    if (editor.value !== originalContent) {
                        saveButton.classList.add('dirty');
                    }
                    break;
            }
        });

        // エディタの内容変更を検知
        editor.addEventListener('input', () => {
            if (isReadOnly) {
                return;
            }
            const isDirty = editor.value !== originalContent;
            if (isDirty) {
                saveButton.classList.add('dirty');
            } else {
                saveButton.classList.remove('dirty');
            }
            vscode.postMessage({
                type: 'contentChanged',
                content: editor.value
            });
        });

        // Run task function
        const runTask = () => {
            if (currentFilePath) {
                // File is open - use the file-based run task
                const isDirty = editor.value !== originalContent;
                vscode.postMessage({
                    type: 'runTask',
                    filePath: currentFilePath,
                    content: isDirty && !isReadOnly ? editor.value : null
                });
            } else {
                // No file open - use editor content directly
                vscode.postMessage({
                    type: 'runTask',
                    editorContent: editor.value
                });
            }
        };

        // Keyboard shortcuts
        editor.addEventListener('keydown', (e) => {
            // Cmd+R / Ctrl+Rで実行
            if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
                e.preventDefault();
                runTask();
            }

            // Cmd+M / Ctrl+MでCreate Markdown File
            if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
                e.preventDefault();
                vscode.postMessage({
                    type: 'createMarkdownFile'
                });
            }
        });

        // Save button click handler
        saveButton.addEventListener('click', () => {
            if (isReadOnly) {
                return;
            }
            vscode.postMessage({
                type: 'save',
                content: editor.value
            });
        });

        // Run button click handler
        runButton.addEventListener('click', () => {
            runTask();
        });

        // Notify extension that webview is ready
        window.addEventListener('load', () => {
            vscode.postMessage({ type: 'webviewReady' });
        });

        // Global key handler for Cmd+M / Ctrl+M (works when webview has focus)
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
                e.preventDefault();
                vscode.postMessage({
                    type: 'createMarkdownFile'
                });
            }
        });
    </script>
</body>
</html>`;
    }
}

// Terminal Provider
class TerminalProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'terminalView';
    private _view?: vscode.WebviewView;
    private _terminalService: TerminalService;
    private _currentSessionId?: string;
    private _outputDisposable?: vscode.Disposable;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {
        this._terminalService = new TerminalService();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Webviewからのメッセージを受信
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'ready':
                    // WebViewの準備が完了したらターミナルを開始
                    await this._startTerminal();
                    break;
                case 'input':
                    // ユーザー入力をPTYに送信
                    if (this._currentSessionId) {
                        this._terminalService.write(this._currentSessionId, data.data);
                    }
                    break;
                case 'resize':
                    // ターミナルサイズの変更
                    if (this._currentSessionId) {
                        this._terminalService.resize(this._currentSessionId, data.cols, data.rows);
                    }
                    break;
                case 'openUrl':
                    // URLをブラウザで開く
                    if (data.url) {
                        vscode.env.openExternal(vscode.Uri.parse(data.url));
                    }
                    break;
                case 'openFile':
                    // ファイルをエディタで開く
                    if (data.path) {
                        const filePath = data.path;
                        const line = data.line;

                        // 相対パスを絶対パスに変換
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        const absolutePath = path.isAbsolute(filePath)
                            ? filePath
                            : path.join(workspaceFolder?.uri.fsPath || '', filePath);

                        try {
                            const uri = vscode.Uri.file(absolutePath);
                            vscode.workspace.fs.stat(uri).then(async () => {
                                const document = await vscode.workspace.openTextDocument(uri);
                                const editor = await vscode.window.showTextDocument(document);

                                if (line) {
                                    const position = new vscode.Position(line - 1, 0);
                                    editor.selection = new vscode.Selection(position, position);
                                    editor.revealRange(new vscode.Range(position, position));
                                }
                            });
                        } catch {
                            // ファイルが存在しない場合は何もしない
                        }
                    }
                    break;
                case 'newTerminal':
                    await this.newTerminal();
                    break;
                case 'clearTerminal':
                    this.clearTerminal();
                    break;
                case 'killTerminal':
                    this.killTerminal();
                    break;
            }
        });

        // WebViewが破棄されたときにセッションを終了
        webviewView.onDidDispose(() => {
            this._cleanup();
        });
    }

    private async _startTerminal(): Promise<void> {
        if (!this._terminalService.isAvailable()) {
            this._view?.webview.postMessage({
                type: 'error',
                message: 'Terminal is not available. node-pty could not be loaded.'
            });
            return;
        }

        try {
            // 既存のセッションをクリーンアップ
            this._cleanup();

            // ワークスペースルートを取得
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            // シェル名を取得
            const config = vscode.workspace.getConfiguration('aiCodingSidebar');
            const shellPath = config.get<string>('terminal.shell') || process.env.SHELL || '/bin/bash';
            const shellName = path.basename(shellPath);

            // 新しいセッションを作成
            this._currentSessionId = await this._terminalService.createSession(workspaceRoot);

            // 出力リスナーを登録
            this._outputDisposable = this._terminalService.onOutput(this._currentSessionId, (data) => {
                this._view?.webview.postMessage({
                    type: 'output',
                    data: data
                });
            });

            // ターミナル開始を通知（シェル名を含む）
            this._view?.webview.postMessage({
                type: 'started',
                shellName: shellName
            });
        } catch (error) {
            console.error('Failed to start terminal:', error);
            this._view?.webview.postMessage({
                type: 'error',
                message: `Failed to start terminal: ${error}`
            });
        }
    }

    private _cleanup(): void {
        if (this._outputDisposable) {
            this._outputDisposable.dispose();
            this._outputDisposable = undefined;
        }
        if (this._currentSessionId) {
            this._terminalService.killSession(this._currentSessionId);
            this._currentSessionId = undefined;
        }
    }

    public clearTerminal(): void {
        this._view?.webview.postMessage({ type: 'clear' });
    }

    public killTerminal(): void {
        this._cleanup();
        this._view?.webview.postMessage({ type: 'killed' });
    }

    public async newTerminal(): Promise<void> {
        this._cleanup();
        this._view?.webview.postMessage({ type: 'clear' });
        await this._startTerminal();
    }

    /**
     * ターミナルにコマンドを送信
     * @param command 実行するコマンド
     * @param addNewline 改行を追加するかどうか（デフォルト: true）
     */
    public async sendCommand(command: string, addNewline: boolean = true): Promise<void> {
        // ターミナルが開始されていない場合は開始
        if (!this._currentSessionId) {
            await this._startTerminal();
        }

        if (this._currentSessionId) {
            // コマンドを送信
            const commandToSend = addNewline ? command + '\n' : command;
            this._terminalService.write(this._currentSessionId, commandToSend);
        }
    }

    /**
     * 複数のパスをターミナルに挿入（改行なし）
     * @param paths 挿入するパスの配列
     */
    public async insertPaths(paths: string[]): Promise<void> {
        // ターミナルが開始されていない場合は開始
        if (!this._currentSessionId) {
            await this._startTerminal();
        }

        if (this._currentSessionId) {
            // スペースで区切ってパスを挿入（改行なし）
            const pathText = paths.join(' ');
            this._terminalService.write(this._currentSessionId, pathText);
        }

        // Terminalビューをフォーカス
        this.focus();
    }

    /**
     * ターミナルビューをフォーカス
     */
    public focus(): void {
        if (this._view) {
            // preserveFocus: false でフォーカスを移動
            this._view.show(false);
            // Webview内のxtermにフォーカスを当てる
            this._view.webview.postMessage({ type: 'focus' });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // xterm.jsのローカルリソースURIを取得
        const xtermCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'xterm', 'xterm.css'));
        const xtermJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'xterm', 'xterm.js'));
        const xtermFitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'xterm', 'xterm-addon-fit.js'));
        const xtermWebLinksUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'xterm', 'xterm-addon-web-links.js'));

        // 設定を取得
        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
        const fontSize = config.get<number>('terminal.fontSize', 12);
        const fontFamily = config.get<string>('terminal.fontFamily', 'monospace');
        const cursorStyle = config.get<string>('terminal.cursorStyle', 'block');
        const cursorBlink = config.get<boolean>('terminal.cursorBlink', true);
        const scrollback = config.get<number>('terminal.scrollback', 1000);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
    <title>Terminal</title>
    <link rel="stylesheet" href="${xtermCssUri}">
    <style>
        html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: var(--vscode-terminal-background, #1e1e1e);
        }
        #header {
            height: 33px;
            padding: 0 8px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-sizing: border-box;
        }
        .header-title {
            display: flex;
            align-items: center;
        }
        .header-actions {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .header-button {
            padding: 2px 6px;
            font-size: 11px;
            background-color: transparent;
            color: var(--vscode-foreground);
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 2px;
            cursor: pointer;
        }
        .header-button:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }
        .header-button.danger:hover {
            background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
        }
        #terminal-container {
            height: calc(100% - 33px);
            width: 100%;
        }
        #error-message {
            color: var(--vscode-errorForeground, #f44747);
            padding: 10px;
            display: none;
        }
        .xterm {
            height: 100%;
        }
    </style>
</head>
<body>
    <div id="header">
        <div class="header-title">
            <span id="shell-name">Terminal</span>
        </div>
        <div class="header-actions">
            <button class="header-button" id="new-button" title="New Terminal">+ New</button>
            <button class="header-button" id="clear-button" title="Clear Terminal">Clear</button>
            <button class="header-button danger" id="kill-button" title="Kill Terminal">Kill</button>
        </div>
    </div>
    <div id="error-message"></div>
    <div id="terminal-container"></div>
    <script src="${xtermJsUri}"></script>
    <script src="${xtermFitUri}"></script>
    <script src="${xtermWebLinksUri}"></script>
    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            const terminalContainer = document.getElementById('terminal-container');
            const errorMessage = document.getElementById('error-message');

            // CSS変数から色を取得するヘルパー関数
            function getCssVar(name, fallback) {
                const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
                return value || fallback;
            }

            // xterm.jsの初期化
            const term = new Terminal({
                fontSize: ${fontSize},
                fontFamily: '${fontFamily}',
                cursorStyle: '${cursorStyle}',
                cursorBlink: ${cursorBlink},
                scrollback: ${scrollback},
                theme: {
                    background: getCssVar('--vscode-terminal-background', '#1e1e1e'),
                    foreground: getCssVar('--vscode-terminal-foreground', '#cccccc'),
                    cursor: getCssVar('--vscode-terminalCursor-foreground', '#ffffff'),
                    cursorAccent: getCssVar('--vscode-terminalCursor-background', '#000000'),
                    selectionBackground: getCssVar('--vscode-terminal-selectionBackground', '#264f78')
                }
            });

            // Fit Addonをロード
            const fitAddon = new FitAddon.FitAddon();
            term.loadAddon(fitAddon);

            // Web Links Addonをロード（URLクリック用）
            const webLinksAddon = new WebLinksAddon.WebLinksAddon((event, uri) => {
                event.preventDefault();
                vscode.postMessage({ type: 'openUrl', url: uri });
            });
            term.loadAddon(webLinksAddon);

            // ターミナルを開く
            term.open(terminalContainer);
            fitAddon.fit();

            // カスタムリンクプロバイダー（ファイルパス用）
            term.registerLinkProvider({
                provideLinks: (bufferLineNumber, callback) => {
                    const line = term.buffer.active.getLine(bufferLineNumber - 1);
                    if (!line) {
                        callback(undefined);
                        return;
                    }
                    const text = line.translateToString();
                    const links = [];

                    // ファイルパスパターン: パス:行番号 または パス
                    // 例: ./src/extension.ts:123, src/file.js, /absolute/path.ts, .claude/tasks/file.md
                    const filePattern = /(?:^|[\\s'":([])(\\.?\\/|\\.\\.?\\/|\\/)?([a-zA-Z0-9_.\\-]+\\/)*[a-zA-Z0-9_.\\-]+\\.[a-zA-Z0-9]+(?::(\\d+))?/g;
                    let match;

                    while ((match = filePattern.exec(text)) !== null) {
                        const fullMatch = match[0];
                        // 先頭の区切り文字を除去
                        const delimMatch = fullMatch.match(/^[\\s'":([]/);
                        const startIndex = match.index + (delimMatch ? delimMatch[0].length : 0);
                        const pathWithLine = delimMatch ? fullMatch.slice(delimMatch[0].length) : fullMatch;

                        // 行番号の抽出
                        const lineMatch = pathWithLine.match(/:(\\d+)$/);
                        const filePath = lineMatch ? pathWithLine.replace(/:(\\d+)$/, '') : pathWithLine;
                        const lineNumber = lineMatch ? parseInt(lineMatch[1]) : undefined;

                        links.push({
                            range: {
                                start: { x: startIndex + 1, y: bufferLineNumber },
                                end: { x: startIndex + pathWithLine.length + 1, y: bufferLineNumber }
                            },
                            text: pathWithLine,
                            activate: () => {
                                vscode.postMessage({
                                    type: 'openFile',
                                    path: filePath,
                                    line: lineNumber
                                });
                            }
                        });
                    }

                    callback(links.length > 0 ? links : undefined);
                }
            });

            // ユーザー入力をExtensionに送信
            term.onData(data => {
                vscode.postMessage({ type: 'input', data: data });
            });

            // リサイズを監視
            const resizeObserver = new ResizeObserver(() => {
                try {
                    // リサイズ前にスクロール位置が最下部かどうかを確認
                    const wasAtBottom = term.buffer.active.viewportY === term.buffer.active.baseY;

                    fitAddon.fit();

                    // スクロール位置が最下部だった場合は維持
                    if (wasAtBottom) {
                        term.scrollToBottom();
                    }

                    vscode.postMessage({
                        type: 'resize',
                        cols: term.cols,
                        rows: term.rows
                    });
                } catch (e) {
                    console.error('Resize error:', e);
                }
            });
            resizeObserver.observe(terminalContainer);

            // Extensionからのメッセージを処理
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.type) {
                    case 'output':
                        term.write(message.data);
                        break;
                    case 'clear':
                        term.clear();
                        break;
                    case 'started':
                        errorMessage.style.display = 'none';
                        terminalContainer.style.display = 'block';
                        // シェル名を更新
                        if (message.shellName) {
                            document.getElementById('shell-name').textContent = message.shellName;
                        }
                        fitAddon.fit();
                        vscode.postMessage({
                            type: 'resize',
                            cols: term.cols,
                            rows: term.rows
                        });
                        break;
                    case 'killed':
                        term.write('\\r\\n[Process terminated]\\r\\n');
                        break;
                    case 'error':
                        errorMessage.textContent = message.message;
                        errorMessage.style.display = 'block';
                        break;
                    case 'focus':
                        term.focus();
                        break;
                }
            });

            // ヘッダーボタンのイベントハンドラ
            document.getElementById('new-button')?.addEventListener('click', () => {
                vscode.postMessage({ type: 'newTerminal' });
            });
            document.getElementById('clear-button')?.addEventListener('click', () => {
                vscode.postMessage({ type: 'clearTerminal' });
            });
            document.getElementById('kill-button')?.addEventListener('click', () => {
                vscode.postMessage({ type: 'killTerminal' });
            });

            // 準備完了を通知
            vscode.postMessage({ type: 'ready' });
        })();
    </script>
</body>
</html>`;
    }

    dispose(): void {
        this._cleanup();
        this._terminalService.dispose();
    }
}

export function deactivate() { }
