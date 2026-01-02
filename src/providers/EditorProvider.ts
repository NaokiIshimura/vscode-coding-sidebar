import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TasksProvider } from './TasksProvider';

// Forward declaration for TerminalProvider to avoid circular dependency
export interface ITerminalProvider {
    focus(): void;
    sendCommand(command: string, addNewline?: boolean): Promise<void>;
}

export class EditorProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    public static readonly viewType = 'markdownEditor';
    private _view?: vscode.WebviewView;
    private _currentFilePath?: string;
    private _currentContent?: string;
    private _pendingContent?: string;
    private _isDirty: boolean = false;
    private _detailsProvider?: TasksProvider;
    private _tasksProvider?: TasksProvider;
    private _terminalProvider?: ITerminalProvider;
    private _pendingFileToRestore?: string;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {
        // アクティブエディタの変更を監視
        this._disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                this._checkAndUpdateReadOnlyState(editor);
            })
        );

        // タブグループの変更を監視（タブの開閉、移動を検知）
        this._disposables.push(
            vscode.window.tabGroups.onDidChangeTabs(event => {
                this._checkAndUpdateReadOnlyState(undefined);
            })
        );

        // ファイル保存を監視してEditor Viewを更新
        this._disposables.push(
            vscode.workspace.onDidSaveTextDocument(async (document) => {
                // 保存されたファイルが現在Editor Viewで開いているファイルと一致するか確認
                if (this._currentFilePath && document.uri.fsPath === this._currentFilePath) {
                    try {
                        // ファイル内容を再読み込み
                        const content = await fs.promises.readFile(this._currentFilePath, 'utf8');

                        // 内容が変更されている場合のみ更新
                        if (content !== this._currentContent) {
                            this._currentContent = content;
                            this._pendingContent = undefined;
                            this._isDirty = false;

                            const displayPath = path.basename(this._currentFilePath);
                            const isOpenInEditor = this._isFileOpenInTab(this._currentFilePath);

                            // Webviewに更新内容を送信
                            if (this._view) {
                                this._view.webview.postMessage({
                                    type: 'showContent',
                                    filePath: displayPath,
                                    content: content,
                                    isReadOnly: isOpenInEditor
                                });
                            }
                        }
                    } catch (error) {
                        console.error(`Failed to reload file after save: ${error}`);
                    }
                }
            })
        );
    }

    /**
     * ファイルがVS Codeのタブで開かれているかチェック
     */
    private _isFileOpenInTab(filePath: string): boolean {
        // すべてのタブグループをチェック
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    if (tab.input.uri.fsPath === filePath) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private _checkAndUpdateReadOnlyState(editor: vscode.TextEditor | undefined) {
        if (!this._view || !this._currentFilePath) {
            return;
        }

        // すべてのタブでファイルが開かれているかチェック（アクティブでなくてもタブが開いていれば）
        const isOpenInEditor = this._isFileOpenInTab(this._currentFilePath);

        // webviewに読み取り専用状態を更新
        this._view.webview.postMessage({
            type: 'setReadOnlyState',
            isReadOnly: isOpenInEditor
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
                    const hadFilePath = !!this._currentFilePath;
                    const savedPath = await this._saveCurrentContent(data.content);
                    if (savedPath) {
                        if (!hadFilePath) {
                            // 新規ファイル作成の場合はファイル名を表示
                            const fileName = path.basename(savedPath);
                            vscode.window.showInformationMessage(`File saved: ${fileName}`);
                        } else {
                            // 既存ファイルの上書き保存
                            vscode.window.showInformationMessage('File saved successfully');
                        }
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
                case 'showWarning':
                    vscode.window.showWarningMessage(data.message);
                    break;
                case 'planTask':
                    // Plan button clicked - save file if needed, then send plan command to terminal
                    // ファイルが未作成 or 未保存の場合、先に保存
                    if (data.content && data.content.trim()) {
                        const planSavedPath = await this._saveCurrentContent(data.content);
                        if (!planSavedPath) {
                            return; // 保存失敗
                        }
                    }

                    if (this._currentFilePath) {
                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        let relativeFilePath: string;

                        if (workspaceRoot) {
                            // Calculate relative path from workspace root
                            relativeFilePath = path.relative(workspaceRoot, this._currentFilePath);
                        } else {
                            // If no workspace, use the full path
                            relativeFilePath = this._currentFilePath;
                        }

                        // Get the plan command template from settings
                        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
                        const commandTemplate = config.get<string>('editor.planCommand', 'claude "Review the file at ${filePath} and create an implementation plan. Save it as a timestamped file (format: YYYY_MMDD_HHMM_SS_plan.md) in the same directory as ${filePath}."');

                        // Replace ${filePath} placeholder with actual file path
                        const command = commandTemplate.replace(/\$\{filePath\}/g, relativeFilePath.trim());

                        // Send command to Terminal view
                        if (this._terminalProvider) {
                            this._terminalProvider.focus();
                            await this._terminalProvider.sendCommand(command);
                        }
                    }
                    break;
                case 'specTask':
                    // Spec button clicked - save file if needed, then send spec command to terminal
                    // ファイルが未作成 or 未保存の場合、先に保存
                    if (data.content && data.content.trim()) {
                        const specSavedPath = await this._saveCurrentContent(data.content);
                        if (!specSavedPath) {
                            return; // 保存失敗
                        }
                    }

                    if (this._currentFilePath) {
                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        let relativeFilePath: string;

                        if (workspaceRoot) {
                            // Calculate relative path from workspace root
                            relativeFilePath = path.relative(workspaceRoot, this._currentFilePath);
                        } else {
                            // If no workspace, use the full path
                            relativeFilePath = this._currentFilePath;
                        }

                        // Get the spec command template from settings
                        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
                        const commandTemplate = config.get<string>('editor.specCommand', 'claude "Review the file at ${filePath} and create specification documents. Save them as timestamped files (format: YYYY_MMDD_HHMM_SS_requirements.md, YYYY_MMDD_HHMM_SS_design.md, YYYY_MMDD_HHMM_SS_tasks.md) in the same directory as ${filePath}."');

                        // Replace ${filePath} placeholder with actual file path
                        const command = commandTemplate.replace(/\$\{filePath\}/g, relativeFilePath.trim());

                        // Send command to Terminal view
                        if (this._terminalProvider) {
                            this._terminalProvider.focus();
                            await this._terminalProvider.sendCommand(command);
                        }
                    }
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
                case 'openInVSCode':
                    // Edit button clicked - save if needed, then open in VS Code editor
                    if (!this._currentFilePath) {
                        vscode.window.showWarningMessage('No file is currently open.');
                        return;
                    }

                    // Save file first if content is provided (unsaved changes)
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

                    // Open file in VS Code editor
                    try {
                        const document = await vscode.workspace.openTextDocument(this._currentFilePath);
                        await vscode.window.showTextDocument(document, {
                            preview: false,
                            preserveFocus: false
                        });
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to open file in editor: ${error}`);
                    }
                    break;
                case 'focusTabInVSCode':
                    // Readonly editor clicked - focus the tab in VS Code
                    if (!this._currentFilePath) {
                        return;
                    }

                    // Find and focus the tab
                    try {
                        // すべてのタブグループをチェックして、該当ファイルのタブを見つける
                        for (const group of vscode.window.tabGroups.all) {
                            for (const tab of group.tabs) {
                                if (tab.input instanceof vscode.TabInputText) {
                                    if (tab.input.uri.fsPath === this._currentFilePath) {
                                        // タブが見つかったら、そのドキュメントを開いてフォーカス
                                        const document = await vscode.workspace.openTextDocument(this._currentFilePath);
                                        await vscode.window.showTextDocument(document, {
                                            preview: false,
                                            preserveFocus: false,
                                            viewColumn: group.viewColumn
                                        });
                                        return;
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Failed to focus tab in VS Code: ${error}`);
                    }
                    break;
            }
        });

        // Restore previously opened file if exists
        // Store file path to restore after webview is ready
        if (this._currentFilePath) {
            this._pendingFileToRestore = this._currentFilePath;
        }

        // Listen to webview disposal
        this._disposables.push(
            webviewView.onDidDispose(async () => {
                // Save changes when webview is disposed
                if (this._currentFilePath && this._isDirty && this._pendingContent) {
                    try {
                        await fs.promises.writeFile(this._currentFilePath, this._pendingContent, 'utf8');
                        this._currentContent = this._pendingContent;
                        this._isDirty = false;
                    } catch (error) {
                        console.error(`Failed to auto-save file on dispose: ${error}`);
                    }
                }
                this._view = undefined;
            })
        );

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
                    const isOpenInEditor = this._isFileOpenInTab(this._currentFilePath);

                    this._view?.webview.postMessage({
                        type: 'showContent',
                        filePath: displayPath,
                        content: content,
                        isReadOnly: isOpenInEditor
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

        // すべてのタブでファイルが開かれているかチェック
        const isOpenInEditor = this._isFileOpenInTab(filePath);

        if (isOpenInEditor) {
            vscode.window.showWarningMessage('This file is open in the editor. Markdown Editor will be read-only.');
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
                    isReadOnly: isOpenInEditor
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

    public setTerminalProvider(provider: ITerminalProvider): void {
        this._terminalProvider = provider;
    }

    public async clearFile(): Promise<void> {
        // Save current file if it has unsaved changes before clearing
        if (this._currentFilePath && this._isDirty && this._pendingContent) {
            try {
                await fs.promises.writeFile(this._currentFilePath, this._pendingContent, 'utf8');
                this._currentContent = this._pendingContent;
                this._isDirty = false;
            } catch (error) {
                console.error(`Failed to auto-save file before clearing: ${error}`);
            }
        }

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

    /**
     * Save pending changes synchronously (for deactivation)
     */
    public saveSync(): void {
        if (this._currentFilePath && this._isDirty && this._pendingContent) {
            try {
                fs.writeFileSync(this._currentFilePath, this._pendingContent, 'utf8');
                this._currentContent = this._pendingContent;
                this._isDirty = false;
            } catch (error) {
                console.error(`Failed to save file on deactivation: ${error}`);
            }
        }
    }

    /**
     * ファイル保存の共通処理
     * @param content 保存する内容
     * @returns 保存成功時はファイルパス、失敗時はnull
     */
    private async _saveCurrentContent(content: string): Promise<string | null> {
        if (this._currentFilePath) {
            // 優先度1: 既存ファイルへの上書き保存
            try {
                await fs.promises.writeFile(this._currentFilePath, content, 'utf8');
                this._currentContent = content;
                this._pendingContent = undefined;
                this._isDirty = false;
                // 保存後に未保存状態をクリア
                this._view?.webview.postMessage({
                    type: 'updateDirtyState',
                    isDirty: false
                });
                return this._currentFilePath;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save file: ${error}`);
                return null;
            }
        } else if (content && content.trim()) {
            // ファイル未開時 - 新規ファイルとして保存
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('No workspace folder is open');
                return null;
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

            // タイムスタンプ付きファイル名を生成 (YYYY_MMDD_HHMM_SS形式)
            const now = new Date();
            const year = String(now.getFullYear());
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const second = String(now.getSeconds()).padStart(2, '0');
            const timestamp = `${year}_${month}${day}_${hour}${minute}_${second}`;

            const fileName = `${timestamp}_PROMPT.md`;
            const filePath = path.join(savePath, fileName);

            try {
                // メタ情報フッターを作成
                const relativeDirPath = workspaceRoot ? path.relative(workspaceRoot, savePath) : savePath;
                const datetime = `${year}/${month}/${day} ${hour}:${minute}:${second}`;
                const footer = `\n\n---\n\nworking dir: ${relativeDirPath}\nprompt file: ${fileName}\ndatetime   : ${datetime}\n`;

                // コンテンツの末尾にフッターを追加
                const contentWithFooter = content + footer;

                await fs.promises.writeFile(filePath, contentWithFooter, 'utf8');

                // 保存したファイルをエディタで開く
                this._currentFilePath = filePath;
                this._currentContent = contentWithFooter;
                this._pendingContent = undefined;
                this._isDirty = false;

                // ファイルパスをWebviewに反映（ファイル名のみ表示）
                const displayPath = path.basename(filePath);
                this._view?.webview.postMessage({
                    type: 'showContent',
                    content: contentWithFooter,
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

                return filePath;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save file: ${error}`);
                return null;
            }
        } else {
            vscode.window.showWarningMessage('Please enter some text before saving.');
            return null;
        }
    }

    /**
     * Dispose the provider and save any pending changes
     */
    public dispose(): void {
        // Save pending changes synchronously
        this.saveSync();

        // Dispose all subscriptions
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
        this._disposables = [];
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
            box-sizing: border-box;
            border: 1px solid transparent;
        }
        body.focused {
            border-color: var(--vscode-focusBorder);
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
            line-height: 16px;
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
            line-height: 16px;
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
            background-color: #f0ad4e;
            color: #ffffff;
            border: none;
        }
        .save-button.dirty:hover {
            background-color: #ec971f;
        }
        .edit-button {
            padding: 2px 8px;
            font-size: 11px;
            line-height: 16px;
            background-color: transparent;
            color: var(--vscode-foreground);
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 2px;
            cursor: pointer;
        }
        .edit-button:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }
        .edit-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .edit-button.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
        }
        .edit-button.active:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .plan-button {
            padding: 2px 8px;
            font-size: 11px;
            line-height: 16px;
            background-color: #28a745;
            color: #ffffff;
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        .plan-button:hover {
            background-color: #218838;
        }
        .plan-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .spec-button {
            padding: 2px 8px;
            font-size: 11px;
            line-height: 16px;
            background-color: #6f42c1;
            color: #ffffff;
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        .spec-button:hover {
            background-color: #5a32a3;
        }
        .spec-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .readonly-indicator {
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 11px;
            color: var(--vscode-editorWarning-foreground);
            background-color: var(--vscode-editor-background);
            padding: 4px 8px;
            border-radius: 3px;
            border: 1px solid var(--vscode-editorWarning-foreground);
            opacity: 0;
            pointer-events: none;
            z-index: 10;
            transition: opacity 0.2s ease-in-out;
        }
        .readonly-indicator.show {
            opacity: 1;
        }
        #editor-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
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
        #shortcuts-overlay {
            position: absolute;
            bottom: 10px;
            right: 10px;
            opacity: 0.4;
            pointer-events: none;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            white-space: pre-line;
            text-align: left;
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div id="header">
        <div class="file-info">
            <span id="file-path"></span>
        </div>
        <div class="header-actions">
            <button class="edit-button" id="edit-button" title="Edit in VS Code">✏️</button>
            <button class="save-button" id="save-button" title="Save file">💾</button>
            <button class="spec-button" id="spec-button" title="Create specification documents">Spec</button>
            <button class="plan-button" id="plan-button" title="Create implementation plan">Plan</button>
            <button class="run-button" id="run-button" title="Run task (Cmd+R / Ctrl+R)">Run</button>
        </div>
    </div>
    <div id="editor-container">
        <span class="readonly-indicator" id="readonly-indicator">Editing in VS Code</span>
        <textarea id="editor" placeholder="Enter prompt here..."></textarea>
        <div id="shortcuts-overlay">Cmd+M / Ctrl+M - Create new markdown file
Cmd+R / Ctrl+R - Run task in terminal</div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const editor = document.getElementById('editor');
        const filePathElement = document.getElementById('file-path');
        const readonlyIndicator = document.getElementById('readonly-indicator');
        const editButton = document.getElementById('edit-button');
        const saveButton = document.getElementById('save-button');
        const specButton = document.getElementById('spec-button');
        const planButton = document.getElementById('plan-button');
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
                        editButton.classList.add('active');
                    } else {
                        editor.removeAttribute('readonly');
                        readonlyIndicator.classList.remove('show');
                        editButton.classList.remove('active');
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
                        editButton.classList.add('active');
                        saveButton.classList.remove('dirty');
                    } else {
                        editor.removeAttribute('readonly');
                        readonlyIndicator.classList.remove('show');
                        editButton.classList.remove('active');
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
                    editButton.classList.remove('active');
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

        // Spec button click handler
        specButton.addEventListener('click', () => {
            const isDirty = editor.value !== originalContent;
            vscode.postMessage({
                type: 'specTask',
                filePath: currentFilePath,
                content: (currentFilePath && isDirty && !isReadOnly) || !currentFilePath ? editor.value : null
            });
        });

        // Plan button click handler
        planButton.addEventListener('click', () => {
            const isDirty = editor.value !== originalContent;
            vscode.postMessage({
                type: 'planTask',
                filePath: currentFilePath,
                content: (currentFilePath && isDirty && !isReadOnly) || !currentFilePath ? editor.value : null
            });
        });

        // Edit button click handler
        editButton.addEventListener('click', () => {
            if (!currentFilePath) {
                vscode.postMessage({
                    type: 'showWarning',
                    message: 'No file is currently open. Please save the file first.'
                });
                return;
            }
            const isDirty = editor.value !== originalContent;
            vscode.postMessage({
                type: 'openInVSCode',
                filePath: currentFilePath,
                content: isDirty && !isReadOnly ? editor.value : null
            });
        });

        // Editor click handler when readonly - focus the tab in VS Code
        editor.addEventListener('click', () => {
            if (isReadOnly && currentFilePath) {
                vscode.postMessage({
                    type: 'focusTabInVSCode',
                    filePath: currentFilePath
                });
            }
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

        // Focus/blur handlers for visual focus indicator
        window.addEventListener('focus', () => {
            document.body.classList.add('focused');
        });
        window.addEventListener('blur', () => {
            document.body.classList.remove('focused');
        });
    </script>
</body>
</html>`;
    }
}
