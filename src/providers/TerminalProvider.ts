import * as vscode from 'vscode';
import * as path from 'path';
import { TerminalService } from '../services/TerminalService';

// Terminal Tab interface
export interface TerminalTab {
    id: string;
    sessionId: string;
    shellName: string;
}

export class TerminalProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'terminalView';
    private _view?: vscode.WebviewView;
    private _terminalService: TerminalService;
    private _tabs: TerminalTab[] = [];
    private _activeTabId?: string;
    private _outputDisposables: Map<string, vscode.Disposable> = new Map();
    private _tabCounter: number = 0;

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
                    // WebViewの準備が完了したら最初のタブを作成
                    await this._createTab();
                    break;
                case 'input':
                    // ユーザー入力をPTYに送信
                    if (data.tabId) {
                        const tab = this._tabs.find(t => t.id === data.tabId);
                        if (tab) {
                            this._terminalService.write(tab.sessionId, data.data);
                        }
                    }
                    break;
                case 'resize':
                    // ターミナルサイズの変更
                    if (data.tabId) {
                        const tab = this._tabs.find(t => t.id === data.tabId);
                        if (tab) {
                            this._terminalService.resize(tab.sessionId, data.cols, data.rows);
                        }
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
                case 'createTab':
                    await this._createTab();
                    break;
                case 'activateTab':
                    this._activateTab(data.tabId);
                    break;
                case 'closeTab':
                    this._closeTab(data.tabId);
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

    private static readonly MAX_TABS = 5;

    private async _createTab(): Promise<void> {
        if (!this._terminalService.isAvailable()) {
            this._view?.webview.postMessage({
                type: 'error',
                message: 'Terminal is not available. node-pty could not be loaded.'
            });
            return;
        }

        // タブ数の上限チェック
        if (this._tabs.length >= TerminalProvider.MAX_TABS) {
            vscode.window.showWarningMessage(`Maximum ${TerminalProvider.MAX_TABS} terminal tabs allowed.`);
            return;
        }

        try {
            // ワークスペースルートを取得
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            // シェル名を取得
            const config = vscode.workspace.getConfiguration('aiCodingSidebar');
            const shellPath = config.get<string>('terminal.shell') || process.env.SHELL || '/bin/bash';
            const shellName = path.basename(shellPath);

            // 新しいセッションを作成
            const sessionId = await this._terminalService.createSession(workspaceRoot);

            // タブを作成
            const tabId = `tab-${++this._tabCounter}`;
            const tab: TerminalTab = {
                id: tabId,
                sessionId: sessionId,
                shellName: shellName
            };
            this._tabs.push(tab);

            // 出力リスナーを登録
            const disposable = this._terminalService.onOutput(sessionId, (data) => {
                this._view?.webview.postMessage({
                    type: 'output',
                    tabId: tabId,
                    data: data
                });
            });
            this._outputDisposables.set(tabId, disposable);

            // タブ作成を通知
            this._view?.webview.postMessage({
                type: 'tabCreated',
                tabId: tabId,
                shellName: shellName,
                tabIndex: this._tabs.length
            });

            // 新しいタブをアクティブ化
            this._activateTab(tabId);
        } catch (error) {
            console.error('Failed to create terminal tab:', error);
            this._view?.webview.postMessage({
                type: 'error',
                message: `Failed to create terminal: ${error}`
            });
        }
    }

    private _activateTab(tabId: string): void {
        const tab = this._tabs.find(t => t.id === tabId);
        if (tab) {
            this._activeTabId = tabId;
            this._view?.webview.postMessage({
                type: 'tabActivated',
                tabId: tabId
            });
        }
    }

    private _closeTab(tabId: string): void {
        const tabIndex = this._tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        const tab = this._tabs[tabIndex];

        // 出力リスナーを解除
        const disposable = this._outputDisposables.get(tabId);
        if (disposable) {
            disposable.dispose();
            this._outputDisposables.delete(tabId);
        }

        // セッションを終了
        this._terminalService.killSession(tab.sessionId);

        // タブを削除
        this._tabs.splice(tabIndex, 1);

        // タブ削除を通知
        this._view?.webview.postMessage({
            type: 'tabClosed',
            tabId: tabId
        });

        // アクティブタブが閉じられた場合、別のタブをアクティブ化
        if (this._activeTabId === tabId) {
            if (this._tabs.length > 0) {
                // 前のタブか最後のタブをアクティブ化
                const newActiveIndex = Math.min(tabIndex, this._tabs.length - 1);
                this._activateTab(this._tabs[newActiveIndex].id);
            } else {
                this._activeTabId = undefined;
            }
        }
    }

    private _cleanup(): void {
        // すべての出力リスナーを解除
        this._outputDisposables.forEach(disposable => disposable.dispose());
        this._outputDisposables.clear();

        // すべてのセッションを終了
        this._tabs.forEach(tab => {
            this._terminalService.killSession(tab.sessionId);
        });
        this._tabs = [];
        this._activeTabId = undefined;
    }

    public clearTerminal(): void {
        if (this._activeTabId) {
            this._view?.webview.postMessage({ type: 'clear', tabId: this._activeTabId });
        }
    }

    public killTerminal(): void {
        // アクティブタブのみを閉じる
        if (this._activeTabId) {
            this._closeTab(this._activeTabId);
        }
    }

    public async newTerminal(): Promise<void> {
        await this._createTab();
    }

    /**
     * ターミナルにコマンドを送信
     * @param command 実行するコマンド
     * @param addNewline 改行を追加するかどうか（デフォルト: true）
     */
    public async sendCommand(command: string, addNewline: boolean = true): Promise<void> {
        // タブがない場合は作成
        if (this._tabs.length === 0) {
            await this._createTab();
        }

        // アクティブタブに送信
        if (this._activeTabId) {
            const tab = this._tabs.find(t => t.id === this._activeTabId);
            if (tab) {
                const commandToSend = addNewline ? command + '\n' : command;
                this._terminalService.write(tab.sessionId, commandToSend);
            }
        }
    }

    /**
     * 複数のパスをターミナルに挿入（改行なし）
     * @param paths 挿入するパスの配列
     */
    public async insertPaths(paths: string[]): Promise<void> {
        // タブがない場合は作成
        if (this._tabs.length === 0) {
            await this._createTab();
        }

        // アクティブタブに送信
        if (this._activeTabId) {
            const tab = this._tabs.find(t => t.id === this._activeTabId);
            if (tab) {
                const pathText = paths.join(' ');
                this._terminalService.write(tab.sessionId, pathText);
            }
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
            padding: 0 4px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-sizing: border-box;
        }
        .tab-bar {
            display: flex;
            align-items: center;
            gap: 2px;
            flex: 1;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: none;
        }
        .tab-bar::-webkit-scrollbar {
            display: none;
        }
        .tab {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            background-color: transparent;
            border: none;
            border-radius: 4px 4px 0 0;
            cursor: pointer;
            white-space: nowrap;
            color: var(--vscode-foreground);
            opacity: 0.7;
            font-size: 11px;
        }
        .tab:hover {
            opacity: 1;
            background-color: var(--vscode-toolbar-hoverBackground);
        }
        .tab.active {
            opacity: 1;
            background-color: var(--vscode-terminal-background, #1e1e1e);
        }
        .tab-title {
            margin-right: 6px;
        }
        .tab-close {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            padding: 0;
            background: none;
            border: none;
            border-radius: 3px;
            color: var(--vscode-foreground);
            cursor: pointer;
            opacity: 0.5;
            font-size: 14px;
            line-height: 1;
        }
        .tab-close:hover {
            opacity: 1;
            background-color: var(--vscode-toolbar-hoverBackground);
        }
        .new-tab-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            padding: 0;
            background: none;
            border: none;
            border-radius: 4px;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 16px;
            flex-shrink: 0;
        }
        .new-tab-button:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }
        .header-actions {
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
            margin-left: 8px;
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
        #terminals-container {
            height: calc(100% - 33px);
            width: 100%;
            position: relative;
        }
        .terminal-wrapper {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: none;
        }
        .terminal-wrapper.active {
            display: block;
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
        <div class="tab-bar" id="tab-bar"></div>
        <button class="new-tab-button" id="new-tab-button" title="New Terminal">+</button>
        <div class="header-actions">
            <button class="header-button" id="clear-button" title="Clear Terminal">Clear</button>
            <button class="header-button danger" id="kill-button" title="Kill Terminal">Kill</button>
        </div>
    </div>
    <div id="error-message"></div>
    <div id="terminals-container"></div>
    <script src="${xtermJsUri}"></script>
    <script src="${xtermFitUri}"></script>
    <script src="${xtermWebLinksUri}"></script>
    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            const tabBar = document.getElementById('tab-bar');
            const terminalsContainer = document.getElementById('terminals-container');
            const errorMessage = document.getElementById('error-message');

            // タブとターミナルの管理
            const tabs = new Map(); // tabId -> { tabEl, wrapperEl, term, fitAddon, isAtBottom }
            let activeTabId = null;

            // CSS変数から色を取得するヘルパー関数
            function getCssVar(name, fallback) {
                const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
                return value || fallback;
            }

            // ターミナル設定
            const terminalConfig = {
                fontSize: ${fontSize},
                fontFamily: '${fontFamily}',
                cursorStyle: '${cursorStyle}',
                cursorBlink: ${cursorBlink},
                scrollback: ${scrollback}
            };

            // 新しいタブを作成
            function createTab(tabId, shellName, tabIndex) {
                // タブ要素を作成
                const tabEl = document.createElement('div');
                tabEl.className = 'tab';
                tabEl.dataset.tabId = tabId;
                tabEl.innerHTML = \`
                    <span class="tab-title">\${shellName}\${tabIndex > 1 ? ' (' + tabIndex + ')' : ''}</span>
                    <button class="tab-close" title="Close">×</button>
                \`;

                // タブクリックでアクティブ化
                tabEl.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('tab-close')) {
                        vscode.postMessage({ type: 'activateTab', tabId: tabId });
                    }
                });

                // 閉じるボタン
                tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
                    e.stopPropagation();
                    vscode.postMessage({ type: 'closeTab', tabId: tabId });
                });

                tabBar.appendChild(tabEl);

                // ターミナルラッパーを作成
                const wrapperEl = document.createElement('div');
                wrapperEl.className = 'terminal-wrapper';
                wrapperEl.dataset.tabId = tabId;
                terminalsContainer.appendChild(wrapperEl);

                // xtermインスタンスを作成
                const term = new Terminal({
                    ...terminalConfig,
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

                // Web Links Addonをロード
                const webLinksAddon = new WebLinksAddon.WebLinksAddon((event, uri) => {
                    event.preventDefault();
                    vscode.postMessage({ type: 'openUrl', url: uri });
                });
                term.loadAddon(webLinksAddon);

                // ターミナルを開く
                term.open(wrapperEl);

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

                        const filePattern = /(?:^|[\\s'":([])(\\.?\\/|\\.\\.?\\/|\\/)?([a-zA-Z0-9_.\\-]+\\/)*[a-zA-Z0-9_.\\-]+\\.[a-zA-Z0-9]+(?::(\\d+))?/g;
                        let match;

                        while ((match = filePattern.exec(text)) !== null) {
                            const fullMatch = match[0];
                            const delimMatch = fullMatch.match(/^[\\s'":([]/);
                            const startIndex = match.index + (delimMatch ? delimMatch[0].length : 0);
                            const pathWithLine = delimMatch ? fullMatch.slice(delimMatch[0].length) : fullMatch;

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
                    vscode.postMessage({ type: 'input', tabId: tabId, data: data });
                });

                // タブ情報を保存
                const tabInfo = {
                    tabEl: tabEl,
                    wrapperEl: wrapperEl,
                    term: term,
                    fitAddon: fitAddon,
                    isAtBottom: true
                };
                tabs.set(tabId, tabInfo);

                // スクロールイベントを監視
                term.onScroll(() => {
                    const buffer = term.buffer.active;
                    tabInfo.isAtBottom = buffer.viewportY >= buffer.baseY;
                });

                // リサイズを監視
                const resizeObserver = new ResizeObserver(() => {
                    if (wrapperEl.classList.contains('active')) {
                        try {
                            fitAddon.fit();
                            term.scrollToBottom();
                            vscode.postMessage({
                                type: 'resize',
                                tabId: tabId,
                                cols: term.cols,
                                rows: term.rows
                            });
                        } catch (e) {
                            console.error('Resize error:', e);
                        }
                    }
                });
                resizeObserver.observe(wrapperEl);

                return tabInfo;
            }

            // タブをアクティブ化
            function activateTab(tabId) {
                const tabInfo = tabs.get(tabId);
                if (!tabInfo) return;

                // すべてのタブを非アクティブ化
                tabs.forEach((info, id) => {
                    info.tabEl.classList.remove('active');
                    info.wrapperEl.classList.remove('active');
                });

                // 指定タブをアクティブ化
                tabInfo.tabEl.classList.add('active');
                tabInfo.wrapperEl.classList.add('active');
                activeTabId = tabId;

                // フィット調整とリサイズ通知
                setTimeout(() => {
                    tabInfo.fitAddon.fit();
                    vscode.postMessage({
                        type: 'resize',
                        tabId: tabId,
                        cols: tabInfo.term.cols,
                        rows: tabInfo.term.rows
                    });
                    tabInfo.term.focus();
                }, 0);
            }

            // タブを閉じる
            function closeTab(tabId) {
                const tabInfo = tabs.get(tabId);
                if (!tabInfo) return;

                tabInfo.tabEl.remove();
                tabInfo.wrapperEl.remove();
                tabInfo.term.dispose();
                tabs.delete(tabId);
            }

            // Extensionからのメッセージを処理
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.type) {
                    case 'tabCreated':
                        createTab(message.tabId, message.shellName, message.tabIndex);
                        errorMessage.style.display = 'none';
                        break;
                    case 'tabActivated':
                        activateTab(message.tabId);
                        break;
                    case 'tabClosed':
                        closeTab(message.tabId);
                        break;
                    case 'output':
                        {
                            const tabInfo = tabs.get(message.tabId);
                            if (tabInfo) {
                                tabInfo.term.write(message.data);
                                if (tabInfo.isAtBottom) {
                                    tabInfo.term.scrollToBottom();
                                }
                            }
                        }
                        break;
                    case 'clear':
                        {
                            const tabInfo = tabs.get(message.tabId);
                            if (tabInfo) {
                                tabInfo.term.clear();
                            }
                        }
                        break;
                    case 'error':
                        errorMessage.textContent = message.message;
                        errorMessage.style.display = 'block';
                        break;
                    case 'focus':
                        if (activeTabId) {
                            const tabInfo = tabs.get(activeTabId);
                            if (tabInfo) {
                                tabInfo.term.focus();
                            }
                        }
                        break;
                }
            });

            // ヘッダーボタンのイベントハンドラ
            document.getElementById('new-tab-button')?.addEventListener('click', () => {
                vscode.postMessage({ type: 'createTab' });
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
