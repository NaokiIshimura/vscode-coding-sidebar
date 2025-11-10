import * as vscode from 'vscode';
import { IFileWatcherService, FileChangeListener } from '../interfaces/IFileWatcherService';
import { GitignoreParser } from './GitignoreParser';

/**
 * リスナー情報
 */
interface ListenerInfo {
    listener: FileChangeListener;
    enabled: boolean;
}

/**
 * ファイルウォッチャーサービスの実装
 * 複数のプロバイダーで共有される単一のファイルウォッチャーを管理
 */
export class FileWatcherService implements IFileWatcherService {
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private listeners: Map<string, ListenerInfo> = new Map();
    private disposables: vscode.Disposable[] = [];
    private gitignoreParser: GitignoreParser | undefined;

    constructor() {
        this.initializeWatcher();
    }

    /**
     * ウォッチャーを初期化
     */
    private async initializeWatcher(): Promise<void> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }

        // ワークスペース全体を監視（除外パターンを適用）
        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        const watchPattern = new vscode.RelativePattern(workspaceFolder, '**/*');
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(watchPattern);

        // Initialize gitignore parser
        this.gitignoreParser = new GitignoreParser(workspaceFolder.uri.fsPath);
        await this.gitignoreParser.parse();

        // ファイル変更イベントをリスナーに通知
        this.disposables.push(
            this.fileWatcher.onDidChange((uri) => this.notifyListeners(uri)),
            this.fileWatcher.onDidCreate((uri) => this.notifyListeners(uri)),
            this.fileWatcher.onDidDelete((uri) => this.notifyListeners(uri))
        );
    }

    /**
     * 登録されたリスナーに変更を通知
     */
    private notifyListeners(uri: vscode.Uri): void {
        // Check if the file should be excluded based on .gitignore patterns
        if (this.gitignoreParser && this.gitignoreParser.shouldExclude(uri.fsPath)) {
            return;
        }

        // 有効なリスナーのみに通知
        this.listeners.forEach((info) => {
            if (info.enabled) {
                info.listener(uri);
            }
        });
    }

    /**
     * ファイル変更リスナーを登録
     */
    registerListener(id: string, listener: FileChangeListener): void {
        this.listeners.set(id, {
            listener,
            enabled: false // デフォルトは無効
        });
    }

    /**
     * リスナーの登録を解除
     */
    unregisterListener(id: string): void {
        this.listeners.delete(id);
    }

    /**
     * 特定のリスナーを有効化
     */
    enableListener(id: string): void {
        const listenerInfo = this.listeners.get(id);
        if (listenerInfo) {
            listenerInfo.enabled = true;
        }
    }

    /**
     * 特定のリスナーを無効化
     */
    disableListener(id: string): void {
        const listenerInfo = this.listeners.get(id);
        if (listenerInfo) {
            listenerInfo.enabled = false;
        }
    }

    /**
     * すべてのリスナーを有効化
     */
    enableAllListeners(): void {
        this.listeners.forEach((info) => {
            info.enabled = true;
        });
    }

    /**
     * すべてのリスナーを無効化
     */
    disableAllListeners(): void {
        this.listeners.forEach((info) => {
            info.enabled = false;
        });
    }

    /**
     * ウォッチャーが有効かどうかを確認
     */
    isWatcherActive(): boolean {
        return Array.from(this.listeners.values()).some(info => info.enabled);
    }

    /**
     * リソースを破棄
     */
    dispose(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }

        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.listeners.clear();
    }
}
