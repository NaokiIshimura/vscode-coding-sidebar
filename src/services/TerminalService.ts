import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { ITerminalService, TerminalOutputListener } from '../interfaces/ITerminalService';

/**
 * ターミナルセッション情報
 */
interface TerminalSession {
    id: string;
    pty: any; // node-pty.IPty
    outputCallbacks: Set<TerminalOutputListener>;
}

/**
 * ターミナルサービスの実装
 * VSCode内蔵のnode-ptyを使用してPTYセッションを管理
 */
export class TerminalService implements ITerminalService {
    private sessions: Map<string, TerminalSession> = new Map();
    private nodePty: any;
    private _isAvailable: boolean = false;
    private sessionCounter: number = 0;

    constructor() {
        this.initNodePty();
    }

    /**
     * node-ptyを初期化
     */
    private initNodePty(): void {
        // 試行するパスのリスト
        const paths = [
            // VSCode内蔵のnode-pty (通常のnode_modules)
            path.join(vscode.env.appRoot, 'node_modules', 'node-pty'),
            // VSCode内蔵のnode-pty (asar)
            path.join(vscode.env.appRoot, 'node_modules.asar', 'node-pty'),
            // VSCode内蔵のnode-pty (asar.unpacked)
            path.join(vscode.env.appRoot, 'node_modules.asar.unpacked', 'node-pty'),
        ];

        for (const ptyPath of paths) {
            try {
                this.nodePty = require(ptyPath);
                this._isAvailable = true;
                console.log('node-pty loaded from:', ptyPath);
                return;
            } catch (error) {
                console.log('Failed to load node-pty from:', ptyPath);
            }
        }

        // フォールバック: 直接requireを試みる
        try {
            this.nodePty = require('node-pty');
            this._isAvailable = true;
            console.log('node-pty loaded via direct require');
        } catch (fallbackError) {
            console.error('Failed to load node-pty:', fallbackError);
            this._isAvailable = false;
        }
    }

    /**
     * デフォルトのシェルパスを取得
     */
    private getDefaultShell(): string {
        const platform = os.platform();
        if (platform === 'win32') {
            return process.env.COMSPEC || 'cmd.exe';
        }
        return process.env.SHELL || '/bin/bash';
    }

    /**
     * ターミナルセッションを作成
     */
    async createSession(cwd?: string): Promise<string> {
        if (!this._isAvailable) {
            throw new Error('node-pty is not available');
        }

        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
        const shellPath = config.get<string>('terminal.shell') || this.getDefaultShell();

        // 作業ディレクトリを決定
        const workingDirectory = cwd ||
            (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath) ||
            os.homedir();

        // セッションIDを生成
        const sessionId = `terminal-${++this.sessionCounter}-${Date.now()}`;

        // シェル引数を設定（ログインシェルとして起動してPATHを正しく設定）
        const shellArgs: string[] = [];
        const platform = os.platform();
        if (platform !== 'win32') {
            // macOS/Linuxではログインシェルとして起動
            shellArgs.push('-l');
        }

        try {
            // 環境変数を設定（UTF-8ロケールを明示的に設定）
            const env = {
                ...process.env,
                LANG: process.env.LANG || 'ja_JP.UTF-8',
                LC_ALL: process.env.LC_ALL || 'ja_JP.UTF-8'
            };

            // PTYプロセスを作成
            const pty = this.nodePty.spawn(shellPath, shellArgs, {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: workingDirectory,
                env: env
            });

            // セッションを保存
            const session: TerminalSession = {
                id: sessionId,
                pty: pty,
                outputCallbacks: new Set()
            };
            this.sessions.set(sessionId, session);

            // PTY出力を監視
            pty.onData((data: string) => {
                session.outputCallbacks.forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error('Error in terminal output callback:', error);
                    }
                });
            });

            // PTY終了を監視
            pty.onExit(() => {
                this.sessions.delete(sessionId);
            });

            return sessionId;
        } catch (error) {
            console.error('Failed to create terminal session:', error);
            throw error;
        }
    }

    /**
     * ターミナルセッションを終了
     */
    killSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            try {
                session.pty.kill();
            } catch (error) {
                console.error('Error killing terminal session:', error);
            }
            session.outputCallbacks.clear();
            this.sessions.delete(sessionId);
        }
    }

    /**
     * ターミナルにデータを書き込む
     */
    write(sessionId: string, data: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            try {
                session.pty.write(data);
            } catch (error) {
                console.error('Error writing to terminal:', error);
            }
        }
    }

    /**
     * 出力リスナーを登録
     */
    onOutput(sessionId: string, callback: TerminalOutputListener): vscode.Disposable {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.outputCallbacks.add(callback);
            return {
                dispose: () => {
                    session.outputCallbacks.delete(callback);
                }
            };
        }
        return { dispose: () => {} };
    }

    /**
     * ターミナルをリサイズ
     */
    resize(sessionId: string, cols: number, rows: number): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            try {
                session.pty.resize(cols, rows);
            } catch (error) {
                console.error('Error resizing terminal:', error);
            }
        }
    }

    /**
     * node-ptyが利用可能かどうかを確認
     */
    isAvailable(): boolean {
        return this._isAvailable;
    }

    /**
     * リソースを破棄
     */
    dispose(): void {
        // すべてのセッションを終了
        this.sessions.forEach((session) => {
            try {
                session.pty.kill();
            } catch (error) {
                console.error('Error disposing terminal session:', error);
            }
            session.outputCallbacks.clear();
        });
        this.sessions.clear();
    }
}
