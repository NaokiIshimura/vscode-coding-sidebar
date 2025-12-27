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

    // Task Panel Managerの初期化
    TaskPanelManager.initialize(context);
    TaskPanelManager.setProviders(tasksProvider);

    // Open Panels Providerの初期化
    const openPanelsProvider = new OpenPanelsProvider();
    TaskPanelManager.setOpenPanelsProvider(openPanelsProvider);

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

    // Open Panels Viewを登録
    const openPanelsView = vscode.window.createTreeView('openPanels', {
        treeDataProvider: openPanelsProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(openPanelsView);

    // Open Panels用のコマンドを登録
    context.subscriptions.push(
        vscode.commands.registerCommand('aiCodingSidebar.focusPanel', (item: OpenPanelItem) => {
            if (item) {
                TaskPanelManager.focusPanel(item.panelId);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiCodingSidebar.closePanel', async (item: OpenPanelItem) => {
            if (item) {
                await TaskPanelManager.closePanel(item.panelId);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiCodingSidebar.refreshOpenPanels', () => {
            openPanelsProvider.refresh();
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
                // ファイル名がYYYY_MMDD_HHMM_TASK.md形式の場合はMarkdown Editorで開く
                const fileName = path.basename(selectedItem.filePath);
                const timestampPattern = /^\d{4}_\d{4}_\d{4}_TASK\.md$/;

                if (timestampPattern.test(fileName)) {
                    // YYYY_MMDD_HHMM_TASK.md形式の場合はMarkdown Editorで開く
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

    // フォルダツリー設定を開くコマンドを登録
    const openFolderTreeSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openFolderTreeSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodingSidebar.defaultRelativePath');
    });

    // Docs設定を開くコマンドを登録
    const openDocsSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openDocsSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:nacn.ai-coding-sidebar markdownList');
    });

    // Editor設定を開くコマンドを登録
    const openEditorSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openEditorSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodingSidebar.editor.runCommand');
    });

    // Task Panel設定を開くコマンドを登録
    const openTaskPanelSettingsCommand = vscode.commands.registerCommand('aiCodingSidebar.openTaskPanelSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodingSidebar.taskPanel');
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

        // 現在の日時を YYYY_MMDD_HHMM 形式で取得
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');

        const timestamp = `${year}_${month}${day}_${hour}${minute}`;
        const fileName = `${timestamp}_TASK.md`;
        const filePath = path.join(targetPath, fileName);

        try {
            // テンプレートを使用してファイル内容を生成
            const variables = {
                datetime: now.toLocaleString(),
                filename: fileName,
                timestamp: timestamp
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
        // default path配下にディレクトリを作成
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const defaultRelativePath = configProvider.getDefaultRelativePath();

        if (!defaultRelativePath || defaultRelativePath.trim() === '') {
            vscode.window.showErrorMessage('Default relative path is not configured');
            return;
        }

        const targetPath = path.join(workspaceRoot, defaultRelativePath);

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

            // 作成したディレクトリ内にMarkdownファイルを作成
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');

            const timestamp = `${year}_${month}${day}_${hour}${minute}`;
            const fileName = `${timestamp}_TASK.md`;
            const filePath = path.join(folderPath, fileName);

            // テンプレートを使用してファイル内容を生成
            const variables = {
                datetime: now.toLocaleString(),
                filename: fileName,
                timestamp: timestamp
            };

            const content = loadTemplate(context, variables);

            // FileOperationServiceを使用してファイル作成
            const result = await fileOperationService.createFile(filePath, content);

            if (result.success) {
                // Directory Listを更新
                tasksProvider.refresh();

                // 作成したディレクトリをDirectory Listで選択状態にする（先に実行）
                await tasksProvider.revealDirectory(folderPath);

                // ビューの更新を待つ（getChildrenが呼ばれてキャッシュが構築されるまで待つ）
                await new Promise(resolve => setTimeout(resolve, 300));

                // 作成したファイルをMarkdown Editor Viewで開く
                await editorProvider.showFile(filePath);

                // ビューの更新を待つ
                await new Promise(resolve => setTimeout(resolve, 150));

                // Tasks Viewで作成したファイルを選択状態にする
                // これによりediting表記も自動的に反映される
                await tasksProvider.revealFile(filePath);

                vscode.window.showInformationMessage(`Created markdown file ${fileName} in "${trimmedFolderName}"`);
            } else {
                vscode.window.showWarningMessage(`Folder created but failed to create markdown file: ${result.error}`);

                // 失敗時もビューを更新してディレクトリを選択状態にする
                tasksProvider.refresh();
                await tasksProvider.revealDirectory(folderPath);
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

    // Open Task Panel コマンドを登録
    const openTaskPanelCommand = vscode.commands.registerCommand('aiCodingSidebar.openTaskPanel', async (item?: FileItem) => {
        if (item && item.isDirectory) {
            await TaskPanelManager.open(item.filePath);
        } else {
            await TaskPanelManager.open();
        }
    });

    // Open Task Panel with path コマンドを登録（ディレクトリクリック用）
    // Tasks viewからの呼び出しは単一パネルで管理
    const openTaskPanelWithPathCommand = vscode.commands.registerCommand('aiCodingSidebar.openTaskPanelWithPath', async (targetPath: string) => {
        if (targetPath) {
            tasksProvider.setActiveFolder(targetPath);
            // 設定でTask Panelが有効な場合のみ開く
            const config = vscode.workspace.getConfiguration('aiCodingSidebar.taskPanel');
            const enabled = config.get<boolean>('enabled', false);
            if (enabled) {
                await TaskPanelManager.openFromTasksView(targetPath);
            }
        }
    });

    context.subscriptions.push(refreshCommand, showInPanelCommand, openFolderCommand, goToParentCommand, setRelativePathCommand, openSettingsCommand, openFolderTreeSettingsCommand, openDocsSettingsCommand, openEditorSettingsCommand, openTaskPanelSettingsCommand, setupWorkspaceCommand, openUserSettingsCommand, openWorkspaceSettingsCommand, setupTemplateCommand, createMarkdownFileCommand, createFileCommand, createFolderCommand, renameCommand, deleteCommand, addDirectoryCommand, newDirectoryCommand, renameDirectoryCommand, deleteDirectoryCommand, archiveDirectoryCommand, checkoutBranchCommand, openTerminalCommand, checkoutDefaultBranchCommand, gitPullCommand, copyRelativePathCommand, openInEditorCommand, copyRelativePathFromEditorCommand, createDefaultPathCommand, openTaskPanelCommand, openTaskPanelWithPathCommand);

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
            this.treeView.title = 'Tasks';
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
            // ビューのルートにドロップされた場合
            targetDir = this.rootPath!;
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
        // Show loader on initial load
        if (this._isInitialLoad && !element) {
            this._isInitialLoad = false;
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (!this.rootPath) {
            return [];
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
            return [createButton];
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
            // ルートディレクトリもクリックでTask Panelを開く
            rootItem.command = {
                command: 'aiCodingSidebar.openTaskPanelWithPath',
                title: 'Open Task Panel',
                arguments: [this.rootPath]
            };

            return [rootItem];
        }

        const targetPath = element.resourceUri!.fsPath;

        // キャッシュに存在する場合は返す
        if (this.itemCache.has(targetPath)) {
            return this.itemCache.get(targetPath)!;
        }

        try {
            const files = this.getFilesInDirectory(targetPath);
            const currentFilePath = this.editorProvider?.getCurrentFilePath();
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

                // ディレクトリの場合はクリックでTask Panelを開く
                if (isDirectory) {
                    item.command = {
                        command: 'aiCodingSidebar.openTaskPanelWithPath',
                        title: 'Open Task Panel',
                        arguments: [file.path]
                    };

                    if (this.activeFolderPath === file.path) {
                        item.description = 'Selected';
                        item.tooltip = `${item.tooltip}\nCurrent folder`;
                    }
                } else {
                    // 現在Markdown Editorで編集中のファイルに「editing」表記を追加
                    if (currentFilePath && file.path === currentFilePath) {
                        item.description = 'editing';
                    }
                }

                return item;
            });

            // キャッシュに保存
            this.itemCache.set(targetPath, items);
            return items;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read directory: ${error}`);
            return [];
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
            const timestampPattern = /^\d{4}_\d{4}_\d{4}_TASK\.md$/;
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
                new MenuItem(
                    'Workspace',
                    'Workspace-level settings',
                    undefined,
                    new vscode.ThemeIcon('folder-opened'),
                    [
                        new MenuItem(
                            'Open Workspace Settings',
                            'Open AI Coding Sidebar workspace settings',
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
                            'Start Task',
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
                ),
                // Beta Features（親項目）
                new MenuItem(
                    'Beta Features',
                    'Experimental features',
                    undefined,
                    new vscode.ThemeIcon('beaker'),
                    [
                        new MenuItem(
                            'Open Task Panel',
                            'Open Docs & Editor in the editor area',
                            {
                                command: 'aiCodingSidebar.openTaskPanel',
                                title: 'Open Task Panel'
                            },
                            new vscode.ThemeIcon('split-horizontal')
                        ),
                        new MenuItem(
                            'Task Panel Settings',
                            'Open Task Panel settings',
                            {
                                command: 'aiCodingSidebar.openTaskPanelSettings',
                                title: 'Task Panel Settings'
                            },
                            new vscode.ThemeIcon('settings-gear')
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

                        // タイムスタンプ付きファイル名を生成
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const hour = String(now.getHours()).padStart(2, '0');
                        const minute = String(now.getMinutes()).padStart(2, '0');
                        const timestamp = `${year}_${month}${day}_${hour}${minute}`;

                        const fileName = `${timestamp}_TASK.md`;
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
                        const commandTemplate = config.get<string>('editor.runCommand', 'claude "read ${filePath} and save your report to the same directory as ${filePath}"');
                        const useTerminalView = config.get<boolean>('editor.useTerminalView', true);

                        // Replace ${filePath} placeholder with actual file path
                        const command = commandTemplate.replace(/\$\{filePath\}/g, relativeFilePath.trim());

                        if (useTerminalView && this._terminalProvider) {
                            // Send command to Terminal view
                            this._terminalProvider.focus();
                            await this._terminalProvider.sendCommand(command);
                        } else {
                            // Use VS Code standard terminal
                            const terminalName = path.basename(path.dirname(this._currentFilePath));
                            let terminal = vscode.window.terminals.find(t => t.name === terminalName);
                            if (!terminal) {
                                terminal = vscode.window.createTerminal(terminalName);
                            }
                            terminal.show();
                            terminal.sendText(command, true);
                        }
                    } else if (data.editorContent && data.editorContent.trim()) {
                        // No file open - use the editor content directly
                        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
                        const commandTemplate = config.get<string>('editor.runCommandWithoutFile', 'claude "${editorContent}"');
                        const useTerminalView = config.get<boolean>('editor.useTerminalView', true);

                        // Replace ${editorContent} placeholder with actual editor content
                        // Escape double quotes in editor content to prevent command injection
                        const escapedContent = data.editorContent.trim().replace(/"/g, '\\"');
                        const command = commandTemplate.replace(/\$\{editorContent\}/g, escapedContent);

                        if (useTerminalView && this._terminalProvider) {
                            // Send command to Terminal view
                            this._terminalProvider.focus();
                            await this._terminalProvider.sendCommand(command);
                        } else {
                            // Use VS Code standard terminal
                            const terminalName = 'AI Coding Sidebar';
                            let terminal = vscode.window.terminals.find(t => t.name === terminalName);
                            if (!terminal) {
                                terminal = vscode.window.createTerminal(terminalName);
                            }
                            terminal.show();
                            terminal.sendText(command, true);
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
        .dirty-indicator {
            margin-left: 4px;
            color: var(--vscode-gitDecoration-modifiedResourceForeground);
            display: none;
        }
        .dirty-indicator.show {
            display: inline;
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
            <span class="dirty-indicator" id="dirty-indicator">●</span>
        </div>
        <div class="header-actions">
            <span class="readonly-indicator" id="readonly-indicator">Read-only</span>
            <button class="run-button" id="run-button" title="Run task (Cmd+R / Ctrl+R)">Run</button>
        </div>
    </div>
    <div id="editor-container">
        <textarea id="editor" placeholder="Shortcuts:
  Cmd+M / Ctrl+M - Create new markdown file
  Cmd+S / Ctrl+S - Save file
  Cmd+R / Ctrl+R - Run task"></textarea>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const editor = document.getElementById('editor');
        const filePathElement = document.getElementById('file-path');
        const dirtyIndicator = document.getElementById('dirty-indicator');
        const readonlyIndicator = document.getElementById('readonly-indicator');
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
                    dirtyIndicator.classList.remove('show');

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
                        dirtyIndicator.classList.add('show');
                    } else {
                        dirtyIndicator.classList.remove('show');
                        originalContent = editor.value;
                    }
                    break;
                case 'setReadOnlyState':
                    isReadOnly = message.isReadOnly || false;
                    if (isReadOnly) {
                        editor.setAttribute('readonly', 'readonly');
                        readonlyIndicator.classList.add('show');
                        dirtyIndicator.classList.remove('show');
                    } else {
                        editor.removeAttribute('readonly');
                        readonlyIndicator.classList.remove('show');
                        // Check if content is dirty when switching back to editable
                        const isDirty = editor.value !== originalContent;
                        if (isDirty) {
                            dirtyIndicator.classList.add('show');
                        }
                    }
                    break;
                case 'clearContent':
                    editor.value = '';
                    originalContent = '';
                    currentFilePath = '';
                    filePathElement.textContent = '';
                    dirtyIndicator.classList.remove('show');
                    readonlyIndicator.classList.remove('show');
                    editor.removeAttribute('readonly');
                    isReadOnly = false;
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
                dirtyIndicator.classList.add('show');
            } else {
                dirtyIndicator.classList.remove('show');
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

        // Cmd+S / Ctrl+Sで保存
        editor.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (isReadOnly) {
                    return;
                }
                vscode.postMessage({
                    type: 'save',
                    content: editor.value
                });
            }

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

// Panel state for each directory
interface PanelState {
    panel: vscode.WebviewPanel;
    rootPath: string;  // 初期ディレクトリ（これより上には移動できない）
    currentPath: string;
    currentFilePath?: string;
    currentContent?: string;
    isDirty: boolean;
    fileWatcher?: vscode.FileSystemWatcher;
    previewViewColumn?: vscode.ViewColumn;  // 下ペインで開いたエディタのビューカラム
}

// Open Panels View item
class OpenPanelItem extends vscode.TreeItem {
    constructor(
        public readonly panelId: string,
        public readonly displayName: string,
        public readonly panelPath: string,
        public readonly isTasksViewPanel: boolean,
        public readonly isDirty: boolean
    ) {
        super(displayName, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'openPanel';
        this.description = isDirty ? '●' : undefined;
        this.tooltip = panelPath;
        this.iconPath = new vscode.ThemeIcon(isTasksViewPanel ? 'list-tree' : 'folder-opened');
        this.command = {
            command: 'aiCodingSidebar.focusPanel',
            title: 'Focus Panel',
            arguments: [this]
        };
    }
}

// Open Panels View provider
class OpenPanelsProvider implements vscode.TreeDataProvider<OpenPanelItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<OpenPanelItem | undefined | null | void> = new vscode.EventEmitter<OpenPanelItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<OpenPanelItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: OpenPanelItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: OpenPanelItem): Promise<OpenPanelItem[]> {
        if (element) {
            return [];
        }

        const items: OpenPanelItem[] = [];

        // Get panels from TaskPanelManager
        const panelInfos = TaskPanelManager.getAllPanelInfos();

        for (const info of panelInfos) {
            items.push(new OpenPanelItem(
                info.id,
                info.displayName,
                info.rootPath,
                info.isTasksViewPanel,
                info.isDirty
            ));
        }

        return items;
    }
}

// Task Panel Manager - DocsとEditorを1つのエディター領域に統合表示
class TaskPanelManager {
    // Tasks view用の単一パネル（ディレクトリ選択時に切り替え）
    private static tasksViewPanel: PanelState | null = null;
    // Open Task Panelコマンド用の複数パネル（ディレクトリごとに管理）
    private static commandPanels: Map<string, PanelState> = new Map();
    private static context: vscode.ExtensionContext;
    private static tasksProvider?: TasksProvider;
    private static openPanelsProvider?: OpenPanelsProvider;

    public static initialize(context: vscode.ExtensionContext): void {
        this.context = context;
    }

    public static setProviders(tasksProvider: TasksProvider): void {
        this.tasksProvider = tasksProvider;
    }

    public static setOpenPanelsProvider(provider: OpenPanelsProvider): void {
        this.openPanelsProvider = provider;
    }

    // Notify OpenPanelsProvider to refresh
    private static notifyPanelChange(): void {
        this.openPanelsProvider?.refresh();
    }

    // Get all panel information for OpenPanelsProvider
    public static getAllPanelInfos(): Array<{
        id: string;
        displayName: string;
        rootPath: string;
        isTasksViewPanel: boolean;
        isDirty: boolean;
    }> {
        const infos: Array<{
            id: string;
            displayName: string;
            rootPath: string;
            isTasksViewPanel: boolean;
            isDirty: boolean;
        }> = [];

        // Tasks View Panel
        if (this.tasksViewPanel) {
            infos.push({
                id: 'tasksView',
                displayName: path.basename(this.tasksViewPanel.rootPath),
                rootPath: this.tasksViewPanel.rootPath,
                isTasksViewPanel: true,
                isDirty: this.tasksViewPanel.isDirty
            });
        }

        // Command Panels
        for (const [panelPath, state] of this.commandPanels) {
            infos.push({
                id: panelPath,
                displayName: path.basename(panelPath),
                rootPath: panelPath,
                isTasksViewPanel: false,
                isDirty: state.isDirty
            });
        }

        return infos;
    }

    // Focus on a specific panel
    public static focusPanel(panelId: string): void {
        if (panelId === 'tasksView' && this.tasksViewPanel) {
            this.tasksViewPanel.panel.reveal();
        } else {
            const state = this.commandPanels.get(panelId);
            if (state) {
                state.panel.reveal();
            }
        }
    }

    // Close a specific panel
    public static async closePanel(panelId: string): Promise<void> {
        if (panelId === 'tasksView' && this.tasksViewPanel) {
            // Check for unsaved changes
            if (this.tasksViewPanel.isDirty && this.tasksViewPanel.currentFilePath && this.tasksViewPanel.currentContent) {
                const result = await vscode.window.showWarningMessage(
                    'Do you want to save changes before closing?',
                    'Save', 'Don\'t Save', 'Cancel'
                );
                if (result === 'Save') {
                    await this.saveCurrentFileForState(this.tasksViewPanel);
                } else if (result === 'Cancel') {
                    return;
                }
            }
            this.tasksViewPanel.panel.dispose();
        } else {
            const state = this.commandPanels.get(panelId);
            if (state) {
                // Check for unsaved changes
                if (state.isDirty && state.currentFilePath && state.currentContent) {
                    const result = await vscode.window.showWarningMessage(
                        'Do you want to save changes before closing?',
                        'Save', 'Don\'t Save', 'Cancel'
                    );
                    if (result === 'Save') {
                        await this.saveCurrentFileForState(state);
                    } else if (result === 'Cancel') {
                        return;
                    }
                }
                state.panel.dispose();
            }
        }
    }

    // Tasks viewからディレクトリ選択時に呼び出される（単一パネルで管理）
    public static async openFromTasksView(targetPath: string): Promise<void> {
        if (!targetPath) {
            vscode.window.showWarningMessage('No folder selected');
            return;
        }

        // 既存のtasksViewパネルがあれば、ディレクトリを切り替え
        if (this.tasksViewPanel) {
            // 未保存の変更がある場合は保存確認
            if (this.tasksViewPanel.isDirty && this.tasksViewPanel.currentFilePath && this.tasksViewPanel.currentContent) {
                const result = await vscode.window.showWarningMessage(
                    'Do you want to save changes before switching directories?',
                    'Save', 'Don\'t Save', 'Cancel'
                );
                if (result === 'Save') {
                    await this.saveCurrentFileForState(this.tasksViewPanel);
                } else if (result === 'Cancel') {
                    return;
                }
            }

            // ディレクトリを切り替え
            this.tasksViewPanel.rootPath = targetPath;
            this.tasksViewPanel.currentPath = targetPath;
            this.tasksViewPanel.currentFilePath = undefined;
            this.tasksViewPanel.currentContent = undefined;
            this.tasksViewPanel.isDirty = false;

            // ファイル監視を更新
            this.setupFileWatcherForState(this.tasksViewPanel);

            // パネルを更新
            await this.updatePanelForState(this.tasksViewPanel);
            this.tasksViewPanel.panel.reveal();

            // Notify OpenPanelsProvider (directory changed)
            this.notifyPanelChange();
            return;
        }

        // 新規パネルを作成
        const panel = vscode.window.createWebviewPanel(
            'aiCodingSidebarTaskPanel',
            `task: ${path.basename(targetPath)}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        // タブアイコンをツリーアイコンに設定（Tasks Viewからの起動用）
        panel.iconPath = {
            light: vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'tree-light.svg'),
            dark: vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'tree-dark.svg')
        };

        // パネル状態を作成
        const panelState: PanelState = {
            panel,
            rootPath: targetPath,
            currentPath: targetPath,
            currentFilePath: undefined,
            currentContent: undefined,
            isDirty: false,
            fileWatcher: undefined
        };

        this.tasksViewPanel = panelState;

        // パネルが閉じられたときの処理
        panel.onDidDispose(() => {
            if (this.tasksViewPanel?.fileWatcher) {
                this.tasksViewPanel.fileWatcher.dispose();
            }
            this.tasksViewPanel = null;
            this.notifyPanelChange();
        });

        // ファイル監視を設定
        this.setupFileWatcherForState(panelState);

        // HTMLを設定
        await this.updatePanelForState(panelState);

        // メッセージハンドリング
        this.setupMessageHandlingForState(panelState);

        // Notify OpenPanelsProvider
        this.notifyPanelChange();
    }

    // Open Task Panelコマンドから呼び出される（ディレクトリごとに複数パネル管理）
    public static async openFromCommand(rootPath?: string): Promise<void> {
        const targetPath = rootPath || this.tasksProvider?.getCurrentPath();
        if (!targetPath) {
            vscode.window.showWarningMessage('No folder selected');
            return;
        }

        // 既存のパネルがあれば再利用
        const existingState = this.commandPanels.get(targetPath);
        if (existingState) {
            existingState.panel.reveal();
            await this.updateFileListForState(existingState);
            return;
        }

        // 新規パネルを作成
        const panel = vscode.window.createWebviewPanel(
            'aiCodingSidebarTaskPanel',
            `task: ${path.basename(targetPath)}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        // タブアイコンをフォルダアイコンに設定
        panel.iconPath = {
            light: vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'folder-light.svg'),
            dark: vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'folder-dark.svg')
        };

        // パネル状態を作成
        const panelState: PanelState = {
            panel,
            rootPath: targetPath,
            currentPath: targetPath,
            currentFilePath: undefined,
            currentContent: undefined,
            isDirty: false,
            fileWatcher: undefined
        };

        this.commandPanels.set(targetPath, panelState);

        // パネルが閉じられたときの処理
        panel.onDidDispose(() => {
            const state = this.commandPanels.get(targetPath);
            if (state?.fileWatcher) {
                state.fileWatcher.dispose();
            }
            this.commandPanels.delete(targetPath);
            this.notifyPanelChange();
        });

        // ファイル監視を設定
        this.setupFileWatcherForState(panelState);

        // HTMLを設定
        await this.updatePanelForState(panelState);

        // メッセージハンドリング
        this.setupMessageHandlingForState(panelState);

        // Notify OpenPanelsProvider
        this.notifyPanelChange();
    }

    // 後方互換性のためのエイリアス
    public static async open(rootPath?: string): Promise<void> {
        return this.openFromCommand(rootPath);
    }

    // ========== ForState版メソッド（PanelStateを直接受け取る） ==========

    private static setupMessageHandlingForState(state: PanelState): void {
        state.panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'selectFile':
                    if (data.filePath) {
                        await this.openFileForState(state, data.filePath);
                    }
                    break;

                case 'save':
                    await this.saveCurrentFileForState(state, data.content);
                    break;

                case 'contentChanged':
                    const wasDirty = state.isDirty;
                    state.isDirty = true;
                    state.currentContent = data.content;
                    if (!wasDirty) {
                        this.notifyPanelChange();
                    }
                    break;

                case 'runTask':
                    await this.runTaskForState(state, data);
                    break;

                case 'createMarkdownFile':
                    await this.createNewMarkdownFileForState(state);
                    break;

                case 'refresh':
                    await this.updateFileListForState(state);
                    break;

                case 'openInVSCode':
                    if (data.filePath) {
                        const fileUri = vscode.Uri.file(data.filePath);
                        await vscode.commands.executeCommand('vscode.open', fileUri, vscode.ViewColumn.Two);
                    }
                    break;

                case 'previewFile':
                    if (data.filePath) {
                        const fileUri = vscode.Uri.file(data.filePath);
                        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
                        const position = config.get<string>('taskPanel.nonTaskFilePosition', 'below');

                        if (position === 'beside') {
                            // Open to the right
                            await vscode.commands.executeCommand('vscode.open', fileUri, vscode.ViewColumn.Two);
                        } else {
                            // Open below
                            if (state.previewViewColumn) {
                                // Reuse existing editor group
                                await vscode.window.showTextDocument(fileUri, {
                                    viewColumn: state.previewViewColumn,
                                    preview: true
                                });
                            } else {
                                // Create new editor group below
                                await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
                                await vscode.commands.executeCommand('workbench.action.newGroupBelow');
                                const doc = await vscode.workspace.openTextDocument(fileUri);
                                const editor = await vscode.window.showTextDocument(doc, { preview: true });
                                state.previewViewColumn = editor.viewColumn;
                            }
                        }
                    }
                    break;

                case 'openDocsSettings':
                    await vscode.commands.executeCommand('aiCodingSidebar.openDocsSettings');
                    break;

                case 'openEditorSettings':
                    await vscode.commands.executeCommand('aiCodingSidebar.openEditorSettings');
                    break;

                case 'copyRelativePath':
                    if (data.filePath) {
                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        if (workspaceRoot) {
                            const relativePath = path.relative(workspaceRoot, data.filePath);
                            await vscode.env.clipboard.writeText(relativePath);
                            vscode.window.showInformationMessage(`Copied: ${relativePath}`);
                        }
                    }
                    break;

                case 'renameFile':
                    if (data.filePath) {
                        const oldName = path.basename(data.filePath);
                        const newName = await vscode.window.showInputBox({
                            prompt: 'Enter new name',
                            value: oldName,
                            validateInput: (value) => {
                                if (!value || !value.trim()) {
                                    return 'Name cannot be empty';
                                }
                                return null;
                            }
                        });
                        if (newName && newName !== oldName) {
                            const newPath = path.join(path.dirname(data.filePath), newName);
                            try {
                                await fs.promises.rename(data.filePath, newPath);
                                vscode.window.showInformationMessage(`Renamed to ${newName}`);
                                if (state.currentFilePath === data.filePath) {
                                    state.currentFilePath = newPath;
                                }
                                await this.updateFileListForState(state);
                                this.tasksProvider?.refresh();
                                this.tasksProvider?.refresh();
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to rename: ${error}`);
                            }
                        }
                    }
                    break;

                case 'deleteFile':
                    if (data.filePath) {
                        const fileName = path.basename(data.filePath);
                        const confirm = await vscode.window.showWarningMessage(
                            `Are you sure you want to delete "${fileName}"?`,
                            { modal: true },
                            'Delete'
                        );
                        if (confirm === 'Delete') {
                            try {
                                await fs.promises.unlink(data.filePath);
                                vscode.window.showInformationMessage(`Deleted ${fileName}`);
                                if (state.currentFilePath === data.filePath) {
                                    state.currentFilePath = undefined;
                                    state.currentContent = undefined;
                                    state.isDirty = false;
                                    state.panel.webview.postMessage({
                                        type: 'showFile',
                                        filePath: '',
                                        fullPath: '',
                                        content: ''
                                    });
                                }
                                await this.updateFileListForState(state);
                                this.tasksProvider?.refresh();
                                this.tasksProvider?.refresh();
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to delete: ${error}`);
                            }
                        }
                    }
                    break;

                case 'openDirectory':
                    if (data.dirPath) {
                        state.currentPath = data.dirPath;
                        state.currentFilePath = undefined;
                        state.currentContent = undefined;
                        state.isDirty = false;
                        this.setupFileWatcherForState(state);
                        await this.updatePanelForState(state);
                    }
                    break;

                case 'openTaskPanelForDir':
                    if (data.dirPath) {
                        await this.openFromCommand(data.dirPath);
                    }
                    break;

                case 'archiveDirectory':
                    if (data.dirPath) {
                        await this.archiveDirectoryForState(state, data.dirPath);
                    }
                    break;
            }
        });
    }

    private static async archiveDirectoryForState(state: PanelState, dirPath: string): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }

        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
        const defaultRelativePath = config.get<string>('defaultRelativePath', '.claude/tasks');

        const defaultTasksPath = path.join(workspaceRoot, defaultRelativePath);
        const archivedDirPath = path.join(defaultTasksPath, 'archived');
        const originalName = path.basename(dirPath);

        try {
            // Create archived directory if it doesn't exist
            if (!fs.existsSync(archivedDirPath)) {
                fs.mkdirSync(archivedDirPath, { recursive: true });
            }

            // Check for name conflicts
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

            // Move directory
            fs.renameSync(dirPath, destPath);

            // Refresh views
            await this.updateFileListForState(state);
            this.tasksProvider?.refresh();
            this.tasksProvider?.refresh();

            if (hasConflict) {
                vscode.window.showInformationMessage(
                    `Directory archived (renamed to "${finalName}" due to name conflict)`
                );
            } else {
                vscode.window.showInformationMessage(
                    `Directory "${originalName}" archived`
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to archive directory: ${error}`);
        }
    }

    private static async openFileForState(state: PanelState, filePath: string): Promise<void> {
        if (state.isDirty && state.currentFilePath && state.currentContent) {
            const result = await vscode.window.showWarningMessage(
                'Do you want to save changes before switching files?',
                'Save', 'Don\'t Save', 'Cancel'
            );
            if (result === 'Save') {
                await this.saveCurrentFileForState(state, state.currentContent);
            } else if (result === 'Cancel') {
                return;
            }
        }

        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            state.currentFilePath = filePath;
            state.currentContent = content;
            state.isDirty = false;

            state.panel.webview.postMessage({
                type: 'showFile',
                filePath: path.basename(filePath),
                fullPath: filePath,
                content: content
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read file: ${error}`);
        }
    }

    private static async saveCurrentFileForState(state: PanelState, content?: string): Promise<void> {
        const contentToSave = content ?? state.currentContent;
        if (!contentToSave) return;

        if (state.currentFilePath) {
            try {
                await fs.promises.writeFile(state.currentFilePath, contentToSave, 'utf8');
                vscode.window.showInformationMessage('File saved successfully');
                state.currentContent = contentToSave;
                state.isDirty = false;
                state.panel.webview.postMessage({
                    type: 'updateDirtyState',
                    isDirty: false
                });
                this.notifyPanelChange();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save file: ${error}`);
            }
        } else if (contentToSave.trim()) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('No workspace folder is open');
                return;
            }

            const savePath = state.currentPath || path.join(workspaceRoot, '.claude/tasks');
            await fs.promises.mkdir(savePath, { recursive: true });

            const now = new Date();
            const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            const fileName = `${timestamp}_TASK.md`;
            const filePath = path.join(savePath, fileName);

            try {
                await fs.promises.writeFile(filePath, contentToSave, 'utf8');
                vscode.window.showInformationMessage(`File saved: ${fileName}`);
                state.currentFilePath = filePath;
                state.currentContent = contentToSave;
                state.isDirty = false;

                await this.updateFileListForState(state);

                state.panel.webview.postMessage({
                    type: 'showFile',
                    filePath: fileName,
                    fullPath: filePath,
                    content: contentToSave
                });
                this.notifyPanelChange();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save file: ${error}`);
            }
        }
    }

    private static async createNewMarkdownFileForState(state: PanelState): Promise<void> {
        if (state.isDirty && state.currentFilePath && state.currentContent) {
            const result = await vscode.window.showWarningMessage(
                'Do you want to save changes before creating a new file?',
                'Save', 'Don\'t Save', 'Cancel'
            );
            if (result === 'Save') {
                await this.saveCurrentFileForState(state, state.currentContent);
            } else if (result === 'Cancel') {
                return;
            }
        }

        const now = new Date();
        const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const fileName = `${timestamp}_TASK.md`;
        const filePath = path.join(state.currentPath, fileName);

        // テンプレートを使用してファイル内容を生成
        const variables = {
            datetime: now.toLocaleString(),
            filename: fileName,
            timestamp: timestamp
        };
        const content = loadTemplate(this.context, variables);

        try {
            await fs.promises.writeFile(filePath, content, 'utf8');
            vscode.window.showInformationMessage(`Created markdown file ${fileName}`);

            state.currentFilePath = filePath;
            state.currentContent = content;
            state.isDirty = false;

            await this.updateFileListForState(state);

            state.panel.webview.postMessage({
                type: 'showFile',
                filePath: fileName,
                fullPath: filePath,
                content: content
            });

            this.tasksProvider?.refresh();
            this.tasksProvider?.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create file: ${error}`);
        }
    }

    private static async runTaskForState(state: PanelState, data: any): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (data.filePath && state.currentFilePath) {
            if (data.content) {
                await this.saveCurrentFileForState(state, data.content);
            }

            const config = vscode.workspace.getConfiguration('aiCodingSidebar');
            const runCommand = config.get<string>('editor.runCommand', 'claude "read ${filePath} and save your report to the same directory as ${filePath}"');
            const command = runCommand.replace(/\$\{filePath\}/g, state.currentFilePath);

            const terminalName = path.dirname(state.currentFilePath).split(path.sep).pop() || 'Task';
            let terminal = vscode.window.terminals.find(t => t.name === terminalName);
            if (!terminal) {
                terminal = vscode.window.createTerminal({
                    name: terminalName,
                    cwd: workspaceRoot
                });
            }
            terminal.show();
            terminal.sendText(command);
        } else if (data.editorContent) {
            const config = vscode.workspace.getConfiguration('aiCodingSidebar');
            const runCommandWithoutFile = config.get<string>('editor.runCommandWithoutFile', 'claude "${editorContent}"');
            const escapedContent = data.editorContent.replace(/"/g, '\\"').replace(/\n/g, '\\n');
            const command = runCommandWithoutFile.replace(/\$\{editorContent\}/g, escapedContent);

            const terminalName = 'Task';
            let terminal = vscode.window.terminals.find(t => t.name === terminalName);
            if (!terminal) {
                terminal = vscode.window.createTerminal({
                    name: terminalName,
                    cwd: workspaceRoot
                });
            }
            terminal.show();
            terminal.sendText(command);
        }
    }

    private static setupFileWatcherForState(state: PanelState): void {
        if (state.fileWatcher) {
            state.fileWatcher.dispose();
        }

        const pattern = new vscode.RelativePattern(state.currentPath, '**/*');
        state.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        const refresh = () => {
            setTimeout(() => this.updateFileListForState(state), 100);
        };

        state.fileWatcher.onDidCreate(refresh);
        state.fileWatcher.onDidDelete(refresh);
    }

    private static async updateFileListForState(state: PanelState): Promise<void> {
        const files = this.getFilesInDirectory(state.currentPath);
        const parentPath = path.dirname(state.currentPath);
        // Use Tasks View root as the boundary for parent navigation
        const tasksViewRoot = this.tasksProvider?.getRootPath();
        // Show parent directory link if:
        // 1. parentPath is not the same as currentPath (not at filesystem root)
        // 2. tasksViewRoot is defined and parentPath starts with tasksViewRoot (don't go above tasks view root)
        const hasParent = parentPath !== state.currentPath &&
            tasksViewRoot !== undefined &&
            parentPath.startsWith(tasksViewRoot);

        state.panel.webview.postMessage({
            type: 'updateFileList',
            files: files.map(f => ({
                name: f.name,
                path: f.path,
                isDirectory: f.isDirectory,
                size: f.size,
                created: f.created.toISOString(),
                modified: f.modified.toISOString()
            })),
            currentFilePath: state.currentFilePath,
            parentPath: hasParent ? parentPath : null
        });
    }

    private static async updatePanelForState(state: PanelState): Promise<void> {
        const files = this.getFilesInDirectory(state.currentPath);
        state.panel.title = `task: ${path.basename(state.currentPath)}`;
        state.panel.webview.html = this.getHtmlForWebview(files, state.currentPath, state.rootPath);
    }

    // ========== 既存メソッド（commandPanels用） ==========

    private static setupMessageHandling(targetPath: string): void {
        const state = this.commandPanels.get(targetPath);
        if (!state) return;

        state.panel.webview.onDidReceiveMessage(async (data) => {
            const currentState = this.commandPanels.get(targetPath);
            if (!currentState) return;

            switch (data.type) {
                case 'selectFile':
                    if (data.filePath) {
                        await this.openFile(targetPath, data.filePath);
                    }
                    break;

                case 'save':
                    await this.saveCurrentFile(targetPath, data.content);
                    break;

                case 'contentChanged':
                    currentState.isDirty = true;
                    currentState.currentContent = data.content;
                    break;

                case 'runTask':
                    await this.runTask(targetPath, data);
                    break;

                case 'createMarkdownFile':
                    await this.createNewMarkdownFile(targetPath);
                    break;

                case 'refresh':
                    await this.updateFileList(targetPath);
                    break;

                case 'openInVSCode':
                    if (data.filePath) {
                        const fileUri = vscode.Uri.file(data.filePath);
                        // Task Panelとは別のペイン（右側）で開く
                        await vscode.commands.executeCommand('vscode.open', fileUri, vscode.ViewColumn.Two);
                    }
                    break;

                case 'openDocsSettings':
                    await vscode.commands.executeCommand('aiCodingSidebar.openDocsSettings');
                    break;

                case 'openEditorSettings':
                    await vscode.commands.executeCommand('aiCodingSidebar.openEditorSettings');
                    break;

                case 'copyRelativePath':
                    if (data.filePath) {
                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        if (workspaceRoot) {
                            const relativePath = path.relative(workspaceRoot, data.filePath);
                            await vscode.env.clipboard.writeText(relativePath);
                            vscode.window.showInformationMessage(`Copied: ${relativePath}`);
                        }
                    }
                    break;

                case 'renameFile':
                    if (data.filePath) {
                        const oldName = path.basename(data.filePath);
                        const newName = await vscode.window.showInputBox({
                            prompt: 'Enter new name',
                            value: oldName,
                            validateInput: (value) => {
                                if (!value || !value.trim()) {
                                    return 'Name cannot be empty';
                                }
                                return null;
                            }
                        });
                        if (newName && newName !== oldName) {
                            const newPath = path.join(path.dirname(data.filePath), newName);
                            try {
                                await fs.promises.rename(data.filePath, newPath);
                                vscode.window.showInformationMessage(`Renamed to ${newName}`);
                                // Update current file path if it was renamed
                                if (currentState.currentFilePath === data.filePath) {
                                    currentState.currentFilePath = newPath;
                                }
                                await this.updateFileList(targetPath);
                                this.tasksProvider?.refresh();
                                this.tasksProvider?.refresh();
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to rename: ${error}`);
                            }
                        }
                    }
                    break;

                case 'deleteFile':
                    if (data.filePath) {
                        const fileName = path.basename(data.filePath);
                        const confirm = await vscode.window.showWarningMessage(
                            `Are you sure you want to delete "${fileName}"?`,
                            { modal: true },
                            'Delete'
                        );
                        if (confirm === 'Delete') {
                            try {
                                await fs.promises.unlink(data.filePath);
                                vscode.window.showInformationMessage(`Deleted ${fileName}`);
                                // Clear editor if deleted file was open
                                if (currentState.currentFilePath === data.filePath) {
                                    currentState.currentFilePath = undefined;
                                    currentState.currentContent = undefined;
                                    currentState.isDirty = false;
                                    currentState.panel.webview.postMessage({
                                        type: 'showFile',
                                        filePath: '',
                                        fullPath: '',
                                        content: ''
                                    });
                                }
                                await this.updateFileList(targetPath);
                                this.tasksProvider?.refresh();
                                this.tasksProvider?.refresh();
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to delete: ${error}`);
                            }
                        }
                    }
                    break;

                case 'openDirectory':
                    if (data.dirPath) {
                        // 現在のパネルの内容を新しいディレクトリに更新
                        currentState.currentPath = data.dirPath;
                        currentState.currentFilePath = undefined;
                        currentState.currentContent = undefined;
                        currentState.isDirty = false;
                        // ファイル監視を新しいディレクトリに更新
                        this.setupFileWatcher(targetPath);
                        // パネルを更新
                        await this.updatePanel(targetPath);
                    }
                    break;

                case 'openTaskPanelForDir':
                    if (data.dirPath) {
                        await this.openFromCommand(data.dirPath);
                    }
                    break;

                case 'archiveDirectory':
                    if (data.dirPath && currentState) {
                        await this.archiveDirectoryForState(currentState, data.dirPath);
                    }
                    break;
            }
        });
    }

    private static async openFile(targetPath: string, filePath: string): Promise<void> {
        const state = this.commandPanels.get(targetPath);
        if (!state) return;

        // 未保存の変更がある場合は保存確認
        if (state.isDirty && state.currentFilePath && state.currentContent) {
            const result = await vscode.window.showWarningMessage(
                'Do you want to save changes before switching files?',
                'Save', 'Don\'t Save', 'Cancel'
            );
            if (result === 'Save') {
                await this.saveCurrentFile(targetPath, state.currentContent);
            } else if (result === 'Cancel') {
                return;
            }
        }

        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            state.currentFilePath = filePath;
            state.currentContent = content;
            state.isDirty = false;

            state.panel.webview.postMessage({
                type: 'showFile',
                filePath: path.basename(filePath),
                fullPath: filePath,
                content: content
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read file: ${error}`);
        }
    }

    private static async saveCurrentFile(targetPath: string, content: string): Promise<void> {
        const state = this.commandPanels.get(targetPath);
        if (!state) return;

        if (state.currentFilePath) {
            try {
                await fs.promises.writeFile(state.currentFilePath, content, 'utf8');
                vscode.window.showInformationMessage('File saved successfully');
                state.currentContent = content;
                state.isDirty = false;
                state.panel.webview.postMessage({
                    type: 'updateDirtyState',
                    isDirty: false
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save file: ${error}`);
            }
        } else if (content && content.trim()) {
            // 新規ファイルとして保存
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('No workspace folder is open');
                return;
            }

            const savePath = state.currentPath || path.join(workspaceRoot, '.claude/tasks');
            await fs.promises.mkdir(savePath, { recursive: true });

            const now = new Date();
            const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            const fileName = `${timestamp}_TASK.md`;
            const filePath = path.join(savePath, fileName);

            try {
                await fs.promises.writeFile(filePath, content, 'utf8');
                vscode.window.showInformationMessage(`File saved: ${fileName}`);
                state.currentFilePath = filePath;
                state.currentContent = content;
                state.isDirty = false;

                // ファイル一覧を更新
                await this.updateFileList(targetPath);

                state.panel.webview.postMessage({
                    type: 'showFile',
                    filePath: fileName,
                    fullPath: filePath,
                    content: content
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save file: ${error}`);
            }
        }
    }

    private static async createNewMarkdownFile(targetPath: string): Promise<void> {
        const state = this.commandPanels.get(targetPath);
        if (!state) {
            vscode.window.showErrorMessage('No folder selected');
            return;
        }

        // 未保存の変更がある場合は保存確認
        if (state.isDirty && state.currentFilePath && state.currentContent) {
            const result = await vscode.window.showWarningMessage(
                'Do you want to save changes before creating a new file?',
                'Save', 'Don\'t Save', 'Cancel'
            );
            if (result === 'Save') {
                await this.saveCurrentFile(targetPath, state.currentContent);
            } else if (result === 'Cancel') {
                return;
            }
        }

        const now = new Date();
        const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const fileName = `${timestamp}_TASK.md`;
        const filePath = path.join(state.currentPath, fileName);

        // テンプレートを使用してファイル内容を生成
        const variables = {
            datetime: now.toLocaleString(),
            filename: fileName,
            timestamp: timestamp
        };
        const content = loadTemplate(this.context, variables);

        try {
            await fs.promises.writeFile(filePath, content, 'utf8');
            vscode.window.showInformationMessage(`Created markdown file ${fileName}`);

            state.currentFilePath = filePath;
            state.currentContent = content;
            state.isDirty = false;

            // Update file list
            await this.updateFileList(targetPath);

            // Show the file in editor
            state.panel.webview.postMessage({
                type: 'showFile',
                filePath: fileName,
                fullPath: filePath,
                content: content
            });

            // Refresh sidebar views
            this.tasksProvider?.refresh();
            this.tasksProvider?.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create file: ${error}`);
        }
    }

    private static async runTask(targetPath: string, data: any): Promise<void> {
        const state = this.commandPanels.get(targetPath);
        if (!state) return;

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (data.filePath && state.currentFilePath) {
            if (data.content) {
                await this.saveCurrentFile(targetPath, data.content);
            }

            const config = vscode.workspace.getConfiguration('aiCodingSidebar');
            const runCommand = config.get<string>('editor.runCommand', 'claude "read ${filePath} and save your report to the same directory as ${filePath}"');
            const command = runCommand.replace(/\$\{filePath\}/g, state.currentFilePath);

            const terminalName = path.dirname(state.currentFilePath).split(path.sep).pop() || 'Task';
            let terminal = vscode.window.terminals.find(t => t.name === terminalName);
            if (!terminal) {
                terminal = vscode.window.createTerminal({
                    name: terminalName,
                    cwd: workspaceRoot
                });
            }
            terminal.show();
            terminal.sendText(command);
        } else if (data.editorContent) {
            const config = vscode.workspace.getConfiguration('aiCodingSidebar');
            const runCommandWithoutFile = config.get<string>('editor.runCommandWithoutFile', 'claude "${editorContent}"');
            const escapedContent = data.editorContent.replace(/"/g, '\\"').replace(/\n/g, '\\n');
            const command = runCommandWithoutFile.replace(/\$\{editorContent\}/g, escapedContent);

            const terminalName = 'Task';
            let terminal = vscode.window.terminals.find(t => t.name === terminalName);
            if (!terminal) {
                terminal = vscode.window.createTerminal({
                    name: terminalName,
                    cwd: workspaceRoot
                });
            }
            terminal.show();
            terminal.sendText(command);
        }
    }

    private static setupFileWatcher(targetPath: string): void {
        const state = this.commandPanels.get(targetPath);
        if (!state) return;

        if (state.fileWatcher) {
            state.fileWatcher.dispose();
        }

        const pattern = new vscode.RelativePattern(state.currentPath, '**/*');
        state.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        const refresh = () => {
            setTimeout(() => this.updateFileList(targetPath), 100);
        };

        state.fileWatcher.onDidCreate(refresh);
        state.fileWatcher.onDidDelete(refresh);
    }

    private static async updateFileList(targetPath: string): Promise<void> {
        const state = this.commandPanels.get(targetPath);
        if (!state) return;

        const files = this.getFilesInDirectory(state.currentPath);
        const parentPath = path.dirname(state.currentPath);
        // Use Tasks View root as the boundary for parent navigation
        const tasksViewRoot = this.tasksProvider?.getRootPath();
        // Show parent directory link if:
        // 1. parentPath is not the same as currentPath (not at filesystem root)
        // 2. tasksViewRoot is defined and parentPath starts with tasksViewRoot (don't go above tasks view root)
        const hasParent = parentPath !== state.currentPath &&
            tasksViewRoot !== undefined &&
            parentPath.startsWith(tasksViewRoot);

        state.panel.webview.postMessage({
            type: 'updateFileList',
            files: files.map(f => ({
                name: f.name,
                path: f.path,
                isDirectory: f.isDirectory,
                size: f.size,
                created: f.created.toISOString(),
                modified: f.modified.toISOString()
            })),
            currentFilePath: state.currentFilePath,
            parentPath: hasParent ? parentPath : null
        });
    }

    private static async updatePanel(targetPath: string): Promise<void> {
        const state = this.commandPanels.get(targetPath);
        if (!state) return;

        const files = this.getFilesInDirectory(state.currentPath);
        state.panel.title = `task: ${path.basename(state.currentPath)}`;
        state.panel.webview.html = this.getHtmlForWebview(files, state.currentPath, state.rootPath);
    }

    private static getFilesInDirectory(dirPath: string): FileInfo[] {
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

            // ディレクトリは名前順でソート
            directories.sort((a, b) => a.name.localeCompare(b.name));

            const config = vscode.workspace.getConfiguration('aiCodingSidebar.markdownList');
            const sortBy = config.get<string>('sortBy', 'created');
            const sortOrder = config.get<string>('sortOrder', 'ascending');

            files.sort((a, b) => {
                let comparison = 0;
                switch (sortBy) {
                    case 'name': comparison = a.name.localeCompare(b.name); break;
                    case 'created': comparison = a.created.getTime() - b.created.getTime(); break;
                    case 'modified': comparison = a.modified.getTime() - b.modified.getTime(); break;
                }
                return sortOrder === 'descending' ? -comparison : comparison;
            });
        } catch (error) {
            console.error(`Failed to read directory: ${error}`);
        }

        // ディレクトリを先に、その後ファイルを返す
        return [...directories, ...files];
    }

    /**
     * Get file icon for webview based on file extension
     */
    private static getFileIconForWebview(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();

        // Markdown files - check if it's a TASK file
        if (ext === '.md') {
            const timestampPattern = /^\d{4}_\d{4}_\d{4}_TASK\.md$/;
            if (timestampPattern.test(fileName)) {
                return '✏️'; // edit icon for TASK files
            }
            return '📝'; // markdown icon
        }

        // Extension-based icons
        const iconMap: { [key: string]: string } = {
            '.ts': '🔷',
            '.tsx': '🔷',
            '.js': '🟡',
            '.jsx': '🟡',
            '.json': '📋',
            '.txt': '📄',
            '.py': '🐍',
            '.java': '☕',
            '.cpp': '📘',
            '.c': '📘',
            '.h': '📘',
            '.css': '🎨',
            '.scss': '🎨',
            '.html': '🌐',
            '.xml': '🌐',
            '.yml': '⚙️',
            '.yaml': '⚙️',
            '.sh': '💻',
            '.bat': '💻',
            '.png': '🖼️',
            '.jpg': '🖼️',
            '.jpeg': '🖼️',
            '.gif': '🖼️',
            '.svg': '🖼️',
            '.pdf': '📕',
            '.zip': '📦',
            '.gitignore': '🔀'
        };

        return iconMap[ext] || '📄';
    }

    private static getHtmlForWebview(files: FileInfo[], currentPath: string, rootPath: string): string {
        const config = vscode.workspace.getConfiguration('aiCodingSidebar.markdownList');
        const sortBy = config.get<string>('sortBy', 'created');
        const sortOrder = config.get<string>('sortOrder', 'ascending');
        const sortByLabel = sortBy === 'name' ? 'Name' : sortBy === 'created' ? 'Created' : 'Modified';
        const sortOrderLabel = sortOrder === 'ascending' ? '↑' : '↓';
        // tasks viewのルートディレクトリからの相対パスを表示
        const tasksViewRoot = this.tasksProvider?.getRootPath();
        const directoryName = tasksViewRoot
            ? path.relative(tasksViewRoot, currentPath) || path.basename(currentPath)
            : path.basename(currentPath);
        const parentPath = path.dirname(currentPath);
        // Show parent directory link if:
        // 1. parentPath is not the same as currentPath (not at filesystem root)
        // 2. tasksViewRoot is defined and parentPath starts with tasksViewRoot (don't go above tasks view root)
        const hasParent = parentPath !== currentPath &&
            tasksViewRoot !== undefined &&
            parentPath.startsWith(tasksViewRoot);

        // 親ディレクトリへのリンク
        const parentDirHtml = hasParent ? `
            <div class="file-item directory-item parent-dir" data-path="${parentPath.replace(/"/g, '&quot;')}" data-is-directory="true">
                <span class="file-name">📁 ..</span>
            </div>
        ` : '';

        const fileListHtml = files.map(file => {
            if (file.isDirectory) {
                return `
                <div class="file-item directory-item" data-path="${file.path.replace(/"/g, '&quot;')}" data-is-directory="true">
                    <span class="file-name">📁 ${file.name}</span>
                </div>
                `;
            }
            const isMarkdown = file.name.endsWith('.md');
            const dateStr = file.created.toLocaleString();
            const fileIcon = this.getFileIconForWebview(file.name);
            return `
                <div class="file-item" data-path="${file.path.replace(/"/g, '&quot;')}" data-is-markdown="${isMarkdown}">
                    <span class="file-name">${fileIcon} ${file.name}</span>
                    <span class="file-date">${dateStr}</span>
                </div>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Coding Sidebar</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            height: 100vh;
            display: flex;
            flex-direction: column;
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
        }

        /* Directory Header */
        #directory-header {
            padding: 10px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-sideBar-background);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #directory-header .directory-label {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
        }
        #directory-header .directory-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        /* Main Content Area */
        #main-content {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        /* Left Panel - File List */
        #file-panel {
            width: 250px;
            min-width: 200px;
            max-width: 400px;
            border-right: 1px solid var(--vscode-panel-border);
            display: flex;
            flex-direction: column;
            background-color: var(--vscode-sideBar-background);
        }
        #file-header {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }
        #file-header .title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--vscode-sideBarSectionHeader-foreground);
        }
        #file-header .sort-info {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }
        .header-buttons {
            display: flex;
            gap: 4px;
        }
        .icon-button {
            background: none;
            border: none;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            padding: 2px 4px;
            font-size: 12px;
            border-radius: 3px;
        }
        .icon-button:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }
        #file-list {
            flex: 1;
            overflow-y: auto;
            padding: 4px 0;
        }
        .file-item {
            padding: 4px 12px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .file-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .file-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }
        .file-name {
            font-size: 13px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .file-date {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }
        .file-item.selected .file-date {
            color: var(--vscode-list-activeSelectionForeground);
            opacity: 0.8;
        }
        .directory-item {
            color: var(--vscode-symbolIcon-folderForeground, var(--vscode-foreground));
        }
        .directory-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .parent-dir {
            opacity: 0.8;
        }

        /* Resizer */
        #resizer {
            width: 4px;
            cursor: col-resize;
            background-color: transparent;
        }
        #resizer:hover {
            background-color: var(--vscode-sash-hoverBorder);
        }

        /* Right Panel - Editor */
        #editor-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 300px;
        }
        #editor-header {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .editor-file-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #current-file {
            font-size: 12px;
        }
        .dirty-indicator {
            color: var(--vscode-gitDecoration-modifiedResourceForeground);
            display: none;
        }
        .dirty-indicator.show { display: inline; }
        .editor-actions {
            display: flex;
            gap: 8px;
        }
        .action-button {
            padding: 2px 8px;
            font-size: 11px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        .action-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        #editor-container {
            flex: 1;
            display: flex;
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
        }
        #editor:focus { outline: none; }
        .empty-state {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }

        /* Context Menu */
        #context-menu {
            position: fixed;
            display: none;
            background-color: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border);
            border-radius: 4px;
            padding: 4px 0;
            min-width: 150px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 1000;
        }
        #context-menu.show {
            display: block;
        }
        .context-menu-item {
            padding: 6px 12px;
            cursor: pointer;
            font-size: 12px;
            color: var(--vscode-menu-foreground);
        }
        .context-menu-item:hover {
            background-color: var(--vscode-menu-selectionBackground);
            color: var(--vscode-menu-selectionForeground);
        }
        .context-menu-separator {
            height: 1px;
            background-color: var(--vscode-menu-separatorBackground);
            margin: 4px 0;
        }
        .dir-only {
            display: none;
        }
        .dir-only.show-dir {
            display: block;
        }
    </style>
</head>
<body>
    <div id="directory-header">
        <span class="directory-label">task:</span>
        <span class="directory-name">${directoryName}</span>
    </div>
    <div id="main-content">
        <div id="file-panel">
            <div id="file-header">
                <div>
                    <span class="title">Docs</span>
                    <span class="sort-info">(${sortByLabel} ${sortOrderLabel})</span>
                </div>
                <div class="header-buttons">
                    <button class="icon-button" id="new-btn" title="New File">+</button>
                    <button class="icon-button" id="refresh-btn" title="Refresh">↻</button>
                    <button class="icon-button" id="docs-settings-btn" title="Docs Settings">⚙</button>
                </div>
            </div>
            <div id="file-list">
                ${files.length === 0 && !hasParent ? '<div class="empty-state">No files</div>' : parentDirHtml + fileListHtml}
            </div>
        </div>
        <div id="resizer"></div>
        <div id="editor-panel">
            <div id="editor-header">
                <div class="editor-file-info">
                    <span id="current-file">Select a file to edit</span>
                    <span class="dirty-indicator" id="dirty-indicator">●</span>
                </div>
                <div class="editor-actions">
                    <button class="icon-button" id="editor-settings-btn" title="Editor Settings">⚙</button>
                    <button class="action-button" id="run-btn" title="Run (Cmd+R)">Run</button>
                </div>
            </div>
            <div id="editor-container">
                <textarea id="editor" placeholder="Select a file from the list or start typing to create a new file...

Shortcuts:
  Cmd+S / Ctrl+S - Save
  Cmd+R / Ctrl+R - Run
  Cmd+M / Ctrl+M - New file"></textarea>
            </div>
        </div>
    </div>
    <div id="context-menu">
        <div class="context-menu-item dir-only" data-action="openTaskPanel">Open Task Panel</div>
        <div class="context-menu-separator dir-only"></div>
        <div class="context-menu-item" data-action="copyPath">Copy Relative Path</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="rename">Rename...</div>
        <div class="context-menu-item" data-action="delete">Delete</div>
        <div class="context-menu-separator dir-only"></div>
        <div class="context-menu-item dir-only" data-action="archive">Archive</div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const fileList = document.getElementById('file-list');
        const editor = document.getElementById('editor');
        const currentFileEl = document.getElementById('current-file');
        const dirtyIndicator = document.getElementById('dirty-indicator');

        let currentFilePath = '';
        let originalContent = '';

        // File selection
        fileList.addEventListener('click', (e) => {
            const item = e.target.closest('.file-item');
            if (!item) return;

            const filePath = item.getAttribute('data-path');
            const isDirectory = item.getAttribute('data-is-directory') === 'true';

            // ディレクトリの場合は開く
            if (isDirectory) {
                vscode.postMessage({ type: 'openDirectory', dirPath: filePath });
                return;
            }

            const fileName = filePath.split('/').pop() || filePath.split('\\\\').pop() || '';
            const isTaskFile = /^\\d{4}_\\d{4}_\\d{4}_TASK\\.md$/.test(fileName);

            if (e.metaKey || e.ctrlKey) {
                // Cmd/Ctrl+click always opens in separate pane
                vscode.postMessage({ type: 'openInVSCode', filePath });
            } else if (isTaskFile) {
                // YYYY_MMDD_HHMM_TASK.md format opens in Editor section
                vscode.postMessage({ type: 'selectFile', filePath });
            } else {
                // Other files open in Preview section
                vscode.postMessage({ type: 'previewFile', filePath });
            }
        });

        // Update selected state
        function updateSelectedFile(filePath) {
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.toggle('selected', item.getAttribute('data-path') === filePath);
            });
        }

        // Editor input
        editor.addEventListener('input', () => {
            const isDirty = editor.value !== originalContent;
            dirtyIndicator.classList.toggle('show', isDirty);
            vscode.postMessage({ type: 'contentChanged', content: editor.value });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                vscode.postMessage({ type: 'save', content: editor.value });
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
                e.preventDefault();
                if (currentFilePath) {
                    vscode.postMessage({ type: 'runTask', filePath: currentFilePath, content: editor.value });
                } else {
                    vscode.postMessage({ type: 'runTask', editorContent: editor.value });
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
                e.preventDefault();
                vscode.postMessage({ type: 'createMarkdownFile' });
            }
        });

        // Context Menu
        const contextMenu = document.getElementById('context-menu');
        let contextMenuTargetPath = '';
        let contextMenuTargetIsDir = false;

        fileList.addEventListener('contextmenu', (e) => {
            const item = e.target.closest('.file-item');
            if (!item) return;

            e.preventDefault();
            contextMenuTargetPath = item.getAttribute('data-path');
            contextMenuTargetIsDir = item.getAttribute('data-is-directory') === 'true';

            // Show/hide directory-only menu items
            document.querySelectorAll('.dir-only').forEach(el => {
                el.classList.toggle('show-dir', contextMenuTargetIsDir);
            });

            contextMenu.style.left = e.clientX + 'px';
            contextMenu.style.top = e.clientY + 'px';
            contextMenu.classList.add('show');
        });

        document.addEventListener('click', () => {
            contextMenu.classList.remove('show');
        });

        contextMenu.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.context-menu-item');
            if (!menuItem) return;

            const action = menuItem.getAttribute('data-action');
            if (!contextMenuTargetPath) return;

            switch (action) {
                case 'openTaskPanel':
                    vscode.postMessage({ type: 'openTaskPanelForDir', dirPath: contextMenuTargetPath });
                    break;
                case 'copyPath':
                    vscode.postMessage({ type: 'copyRelativePath', filePath: contextMenuTargetPath });
                    break;
                case 'rename':
                    vscode.postMessage({ type: 'renameFile', filePath: contextMenuTargetPath });
                    break;
                case 'delete':
                    vscode.postMessage({ type: 'deleteFile', filePath: contextMenuTargetPath });
                    break;
                case 'archive':
                    vscode.postMessage({ type: 'archiveDirectory', dirPath: contextMenuTargetPath });
                    break;
            }

            contextMenu.classList.remove('show');
        });

        // Buttons
        document.getElementById('new-btn').addEventListener('click', () => {
            vscode.postMessage({ type: 'createMarkdownFile' });
        });
        document.getElementById('refresh-btn').addEventListener('click', () => {
            vscode.postMessage({ type: 'refresh' });
        });
        document.getElementById('run-btn').addEventListener('click', () => {
            if (currentFilePath) {
                vscode.postMessage({ type: 'runTask', filePath: currentFilePath, content: editor.value });
            } else {
                vscode.postMessage({ type: 'runTask', editorContent: editor.value });
            }
        });
        document.getElementById('docs-settings-btn').addEventListener('click', () => {
            vscode.postMessage({ type: 'openDocsSettings' });
        });
        document.getElementById('editor-settings-btn').addEventListener('click', () => {
            vscode.postMessage({ type: 'openEditorSettings' });
        });

        // Resizer
        const resizer = document.getElementById('resizer');
        const filePanel = document.getElementById('file-panel');
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
        });

        function resize(e) {
            if (!isResizing) return;
            const newWidth = e.clientX;
            if (newWidth >= 150 && newWidth <= 500) {
                filePanel.style.width = newWidth + 'px';
            }
        }

        function stopResize() {
            isResizing = false;
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        }

        // Messages from extension
        window.addEventListener('message', (e) => {
            const msg = e.data;
            switch (msg.type) {
                case 'showFile':
                    editor.value = msg.content;
                    originalContent = msg.content;
                    currentFilePath = msg.fullPath;
                    currentFileEl.textContent = msg.filePath;
                    dirtyIndicator.classList.remove('show');
                    updateSelectedFile(msg.fullPath);
                    break;
                case 'updateDirtyState':
                    dirtyIndicator.classList.toggle('show', msg.isDirty);
                    if (!msg.isDirty) originalContent = editor.value;
                    break;
                case 'updateFileList':
                    const listEl = document.getElementById('file-list');
                    if (msg.files.length === 0 && !msg.parentPath) {
                        listEl.innerHTML = '<div class="empty-state">No files</div>';
                    } else {
                        let html = '';
                        // 親ディレクトリへのリンク
                        if (msg.parentPath) {
                            html += '<div class="file-item directory-item parent-dir" data-path="' + msg.parentPath.replace(/"/g, '&quot;') + '" data-is-directory="true">' +
                                '<span class="file-name">📁 ..</span>' +
                                '</div>';
                        }
                        html += msg.files.map(f => {
                            if (f.isDirectory) {
                                return '<div class="file-item directory-item" data-path="' + f.path.replace(/"/g, '&quot;') + '" data-is-directory="true">' +
                                    '<span class="file-name">📁 ' + f.name + '</span>' +
                                    '</div>';
                            }
                            const isMarkdown = f.name.endsWith('.md');
                            const dateStr = new Date(f.created).toLocaleString();
                            const selected = f.path === msg.currentFilePath ? ' selected' : '';
                            return '<div class="file-item' + selected + '" data-path="' + f.path.replace(/"/g, '&quot;') + '" data-is-markdown="' + isMarkdown + '">' +
                                '<span class="file-name">' + f.name + '</span>' +
                                '<span class="file-date">' + dateStr + '</span>' +
                                '</div>';
                        }).join('');
                        listEl.innerHTML = html;
                    }
                    break;
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

            // 新しいセッションを作成
            this._currentSessionId = await this._terminalService.createSession(workspaceRoot);

            // 出力リスナーを登録
            this._outputDisposable = this._terminalService.onOutput(this._currentSessionId, (data) => {
                this._view?.webview.postMessage({
                    type: 'output',
                    data: data
                });
            });

            // ターミナル開始を通知
            this._view?.webview.postMessage({
                type: 'started'
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
     * ターミナルビューをフォーカス
     */
    public focus(): void {
        if (this._view) {
            this._view.show(true);
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
        #terminal-container {
            height: 100%;
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
                    fitAddon.fit();
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
                }
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
