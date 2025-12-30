import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TasksProvider } from './TasksProvider';

// Forward declaration for TerminalProvider to avoid circular dependency
export interface ITerminalProvider {
    focus(): void;
    sendCommand(command: string, addNewline?: boolean): Promise<void>;
}

export class EditorProvider implements vscode.WebviewViewProvider {
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

    public setTerminalProvider(provider: ITerminalProvider): void {
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
            <span class="readonly-indicator" id="readonly-indicator">Read-only</span>
            <button class="save-button" id="save-button" title="Save file">Save</button>
            <button class="run-button" id="run-button" title="Run task (Cmd+R / Ctrl+R)">Run</button>
        </div>
    </div>
    <div id="editor-container">
        <textarea id="editor" placeholder="Enter prompt here..."></textarea>
        <div id="shortcuts-overlay">Cmd+M / Ctrl+M - Create new markdown file
Cmd+R / Ctrl+R - Run task in terminal</div>
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
