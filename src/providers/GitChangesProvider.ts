import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';

// Git変更ファイル用TreeDataProvider実装
export class GitChangesProvider implements vscode.TreeDataProvider<GitFileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<GitFileItem | undefined | null | void> = new vscode.EventEmitter<GitFileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<GitFileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {
        // ファイルシステムの変更を監視
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        watcher.onDidChange(() => this.refresh());
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get parent of an element (required for reveal() method)
     * Git changes view doesn't have hierarchy, so always returns undefined
     */
    async getParent(element: GitFileItem): Promise<GitFileItem | undefined> {
        return undefined;
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
        return new Promise((resolve, reject) => {
            // HEADバージョンの内容を取得
            exec(`git show HEAD:"${relativePath}"`, { cwd: workspaceRoot }, async (error, stdout, stderr) => {
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
        return new Promise((resolve, reject) => {
            exec(`git show HEAD:"${relativePath}"`, { cwd: workspaceRoot }, async (error, stdout, stderr) => {
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

        try {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const gitChanges = await this.getGitChanges(workspaceRoot);

            return gitChanges.map(change => new GitFileItem(
                path.basename(change.path),
                change.path,
                change.status,
                change.relativePath
            ));
        } catch (error) {
            console.log('Git変更の取得に失敗しました:', error);
            return [];
        }
    }

    private async getGitChanges(workspaceRoot: string): Promise<GitChange[]> {
        return new Promise((resolve, reject) => {

            // git statusコマンドでポーセリン形式で変更ファイルを取得
            exec('git status --porcelain=v1', { cwd: workspaceRoot }, (error: any, stdout: string, stderr: string) => {
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

                            changes.push({
                                path: fullPath,
                                relativePath: relativePath,
                                status: this.parseGitStatus(status)
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
}

// Git変更ファイル用TreeItem実装
export class GitFileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string,
        public readonly status: string,
        public readonly relativePath: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);

        this.resourceUri = vscode.Uri.file(filePath);
        this.contextValue = 'gitFile';

        // ステータスに応じたアイコンを設定
        this.iconPath = this.getStatusIcon(status);

        // 説明にステータスと相対パスを表示
        this.description = `${status} • ${relativePath}`;

        // ツールチップを設定
        this.tooltip = `${relativePath}\nStatus: ${status}`;

        // クリックで差分を表示
        this.command = {
            command: 'fileList.showGitDiff',
            title: 'Show Git Diff',
            arguments: [this]
        };
    }

    private getStatusIcon(status: string): vscode.ThemeIcon {
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
}

// GitのHEADバージョンのコンテンツプロバイダー
class GitHeadContentProvider implements vscode.TextDocumentContentProvider {
    constructor(private content: string) { }

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.content;
    }
}