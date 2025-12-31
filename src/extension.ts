import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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

// ユーティリティのインポート
import { loadTemplate } from './utils/templateUtils';
import { setupSettingsJson, setupTemplate, setupClaudeFolder } from './utils/workspaceSetup';

// プロバイダーのインポート
import { TasksProvider, MenuProvider, EditorProvider, TerminalProvider, FileItem } from './providers';

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
                // ファイル名がYYYY_MMDD_HHMM_SS_(PROMPT|TASK|SPEC).md形式の場合はMarkdown Editorで開く
                const fileName = path.basename(selectedItem.filePath);
                const timestampPattern = /^\d{4}_\d{4}_\d{4}_\d{2}_(PROMPT|TASK|SPEC)\.md$/;

                if (timestampPattern.test(fileName)) {
                    // タイムスタンプ形式の場合はMarkdown Editorで開く
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
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodingSidebar.editor');
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

        // 現在の日時を YYYY_MMDD_HHMM_SS 形式で取得
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');

        const timestamp = `${year}_${month}${day}_${hour}${minute}_${second}`;
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

            // promptテンプレートを使用
            const content = loadTemplate(context, variables, 'prompt');

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

    // TASKファイルを作成するコマンドを登録
    const createTaskFileCommand = vscode.commands.registerCommand('aiCodingSidebar.createTaskFile', async (item?: FileItem) => {
        let targetPath: string;

        // 優先順位に従って作成先を決定
        if (item) {
            if (item.isDirectory) {
                targetPath = item.filePath;
            } else {
                targetPath = path.dirname(item.filePath);
            }
        } else {
            const currentPath = tasksProvider.getCurrentPath();
            if (!currentPath) {
                vscode.window.showErrorMessage('No folder is open');
                return;
            }
            targetPath = currentPath;
        }

        // 現在の日時を YYYY_MMDD_HHMM_SS 形式で取得
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');

        const timestamp = `${year}_${month}${day}_${hour}${minute}_${second}`;
        const fileName = `${timestamp}_TASK.md`;
        const filePath = path.join(targetPath, fileName);

        try {
            // テンプレートを使用してファイル内容を生成
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

            // taskテンプレートを使用
            const content = loadTemplate(context, variables, 'task');

            // FileOperationServiceを使用してファイル作成
            const result = await fileOperationService.createFile(filePath, content);

            if (result.success) {
                // ビューを更新
                tasksProvider.refresh();

                // 作成したファイルをMarkdown Editor Viewで開く
                await editorProvider.showFile(filePath);

                // Editor Viewにフォーカスを移動
                await vscode.commands.executeCommand('markdownEditor.focus');

                vscode.window.showInformationMessage(`Created task file ${fileName}`);
            } else {
                throw result.error || new Error('Failed to create file');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create task file: ${error}`);
        }
    });

    // SPECファイルを作成するコマンドを登録
    const createSpecFileCommand = vscode.commands.registerCommand('aiCodingSidebar.createSpecFile', async (item?: FileItem) => {
        let targetPath: string;

        // 優先順位に従って作成先を決定
        if (item) {
            if (item.isDirectory) {
                targetPath = item.filePath;
            } else {
                targetPath = path.dirname(item.filePath);
            }
        } else {
            const currentPath = tasksProvider.getCurrentPath();
            if (!currentPath) {
                vscode.window.showErrorMessage('No folder is open');
                return;
            }
            targetPath = currentPath;
        }

        // 現在の日時を YYYY_MMDD_HHMM_SS 形式で取得
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');

        const timestamp = `${year}_${month}${day}_${hour}${minute}_${second}`;
        const fileName = `${timestamp}_SPEC.md`;
        const filePath = path.join(targetPath, fileName);

        try {
            // テンプレートを使用してファイル内容を生成
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

            // specテンプレートを使用
            const content = loadTemplate(context, variables, 'spec');

            // FileOperationServiceを使用してファイル作成
            const result = await fileOperationService.createFile(filePath, content);

            if (result.success) {
                // ビューを更新
                tasksProvider.refresh();

                // 作成したファイルをMarkdown Editor Viewで開く
                await editorProvider.showFile(filePath);

                // Editor Viewにフォーカスを移動
                await vscode.commands.executeCommand('markdownEditor.focus');

                vscode.window.showInformationMessage(`Created spec file ${fileName}`);
            } else {
                throw result.error || new Error('Failed to create file');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create spec file: ${error}`);
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
                // ディレクトリの場合はリネーム後のディレクトリに移動（Editorはクリアしない）
                if (item.isDirectory) {
                    tasksProvider.setActiveFolder(newPath, true);
                } else {
                    // ファイルの場合はビューを更新
                    tasksProvider.refresh();
                }

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
            const year = String(now.getFullYear());
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const second = String(now.getSeconds()).padStart(2, '0');

            const timestamp = `${year}_${month}${day}_${hour}${minute}_${second}`;
            const fileName = `${timestamp}_TASK.md`;
            const filePath = path.join(folderPath, fileName);

            // テンプレートを使用してファイル内容を生成
            // ワークスペースルートからの相対パスを計算
            const relativeFilePath = workspaceRoot ? path.relative(workspaceRoot, filePath) : filePath;
            const relativeDirPath = workspaceRoot ? path.relative(workspaceRoot, folderPath) : folderPath;

            const variables = {
                datetime: now.toLocaleString(),
                filename: fileName,
                timestamp: timestamp,
                filepath: relativeFilePath,
                dirpath: relativeDirPath
            };

            // taskテンプレートを使用
            const content = loadTemplate(context, variables, 'task');

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

    // 新しいSpecディレクトリを作成してMarkdownファイルも作成するコマンド（タイトルメニュー用）
    const newSpecCommand = vscode.commands.registerCommand('aiCodingSidebar.newSpec', async (item?: FileItem) => {
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
            const year = String(now.getFullYear());
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const second = String(now.getSeconds()).padStart(2, '0');

            const timestamp = `${year}_${month}${day}_${hour}${minute}_${second}`;
            const fileName = `${timestamp}_SPEC.md`;
            const filePath = path.join(folderPath, fileName);

            // テンプレートを使用してファイル内容を生成
            // ワークスペースルートからの相対パスを計算
            const relativeFilePath = workspaceRoot ? path.relative(workspaceRoot, filePath) : filePath;
            const relativeDirPath = workspaceRoot ? path.relative(workspaceRoot, folderPath) : folderPath;

            const variables = {
                datetime: now.toLocaleString(),
                filename: fileName,
                timestamp: timestamp,
                filepath: relativeFilePath,
                dirpath: relativeDirPath
            };

            // specテンプレートを使用
            const content = loadTemplate(context, variables, 'spec');

            // FileOperationServiceを使用してファイル作成
            const result = await fileOperationService.createFile(filePath, content);

            if (result.success) {
                // ビューを更新してファイル一覧に新しいファイルを反映
                tasksProvider.refresh();

                // ビューの更新を待つ
                await new Promise(resolve => setTimeout(resolve, 300));

                // 作成したファイルをMarkdown Editor Viewで開く
                await editorProvider.showFile(filePath);

                vscode.window.showInformationMessage(`Created spec file ${fileName} in "${trimmedFolderName}"`);
            } else {
                vscode.window.showWarningMessage(`Folder created but failed to create spec file: ${result.error}`);
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
        // アーカイブ対象のパスを決定
        let targetPath: string;
        let isCurrentDirectory = false;  // 現在表示中のディレクトリをアーカイブする場合

        if (item && item.isDirectory) {
            // 通常のディレクトリアイテムからの呼び出し
            targetPath = item.filePath;
            // pathDisplayNonRootからの呼び出し（現在のディレクトリをアーカイブ）
            if (item.contextValue === 'pathDisplayNonRoot') {
                isCurrentDirectory = true;
            }
        } else {
            // itemがない場合は現在のactiveFolderPathを使用
            const activePath = tasksProvider.getActiveFolderPath();
            const rootPath = tasksProvider.getRootPath();
            if (!activePath || activePath === rootPath) {
                vscode.window.showErrorMessage('Cannot archive root directory');
                return;
            }
            targetPath = activePath;
            isCurrentDirectory = true;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }

        const defaultRelativePath = configProvider.getDefaultRelativePath();
        if (!defaultRelativePath) {
            vscode.window.showErrorMessage('Default task path is not configured');
            return;
        }

        // archivedディレクトリの作成ロジック
        const defaultTasksPath = path.join(workspaceRoot, defaultRelativePath);
        const archivedDirPath = path.join(defaultTasksPath, 'archived');
        const originalName = path.basename(targetPath);

        try {
            if (!fs.existsSync(archivedDirPath)) {
                const result = await fileOperationService.createDirectory(archivedDirPath);
                if (!result.success) {
                    throw result.error || new Error('Failed to create archived directory');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create archived directory: ${error}`);
            return;
        }

        // 名前競合チェックと移動先パス決定ロジック
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

        // ディレクトリ移動とビュー更新
        try {
            const result = await fileOperationService.moveFile(targetPath, destPath);
            if (!result.success) {
                throw result.error || new Error('Failed to move directory');
            }

            // 現在のディレクトリをアーカイブした場合はルートディレクトリに戻る
            if (isCurrentDirectory) {
                const rootPath = tasksProvider.getRootPath();
                if (rootPath) {
                    tasksProvider.navigateToDirectory(rootPath);
                }
            }

            // ビューを更新
            tasksProvider.refresh();

            // ユーザーフィードバック
            if (hasConflict) {
                vscode.window.showInformationMessage(
                    `Directory archived (renamed to "${finalName}" due to conflict)`
                );
            } else {
                vscode.window.showInformationMessage(
                    `Directory "${originalName}" archived`
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to archive directory: ${error}`);
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

    context.subscriptions.push(refreshCommand, showInPanelCommand, openFolderCommand, goToParentCommand, setRelativePathCommand, openSettingsCommand, openTasksSettingsCommand, openEditorSettingsCommand, openTerminalSettingsCommand, setupWorkspaceCommand, openUserSettingsCommand, openWorkspaceSettingsCommand, setupTemplateCommand, createMarkdownFileCommand, createTaskFileCommand, createSpecFileCommand, createFileCommand, createFolderCommand, renameCommand, deleteCommand, addDirectoryCommand, newDirectoryCommand, newSpecCommand, renameDirectoryCommand, deleteDirectoryCommand, archiveDirectoryCommand, checkoutBranchCommand, openTerminalCommand, checkoutDefaultBranchCommand, gitPullCommand, copyRelativePathCommand, openInEditorCommand, copyRelativePathFromEditorCommand, createDefaultPathCommand, navigateToDirectoryCommand, insertPathToEditorCommand, insertPathToTerminalCommand);

    // プロバイダーのリソースクリーンアップを登録
    context.subscriptions.push({
        dispose: () => {
            tasksProvider.dispose();
            editorProvider.dispose();
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

export function deactivate() { }
