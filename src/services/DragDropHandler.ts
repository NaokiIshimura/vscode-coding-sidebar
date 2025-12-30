import * as vscode from 'vscode';
import * as path from 'path';
import { IFileOperationService } from '../interfaces/IFileOperationService';

/**
 * ドラッグ&ドロップ操作の種類
 */
export enum DragDropOperation {
    Move = 'move',
    Copy = 'copy'
}

/**
 * ドラッグ&ドロップハンドラー
 */
export class DragDropHandler<T extends vscode.TreeItem> {
    readonly dragMimeTypes = ['application/vnd.code.tree.fileItem'];
    readonly dropMimeTypes = ['application/vnd.code.tree.fileItem', 'text/uri-list'];

    constructor(private fileOperationService: IFileOperationService) {}

    /**
     * ドラッグ開始処理
     */
    handleDrag(
        source: readonly T[],
        dataTransfer: vscode.DataTransfer,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        // ドラッグするアイテムをDataTransferに設定
        dataTransfer.set(
            'application/vnd.code.tree.fileItem',
            new vscode.DataTransferItem(source)
        );
    }

    /**
     * ドロップ処理
     */
    async handleDrop(
        target: T | undefined,
        dataTransfer: vscode.DataTransfer,
        token: vscode.CancellationToken,
        getItemPath: (item: T) => string,
        isDirectory: (item: T) => boolean,
        defaultTargetDir?: string
    ): Promise<void> {
        const transferItem = dataTransfer.get('application/vnd.code.tree.fileItem');
        if (!transferItem) {
            return;
        }

        const sourceItems = transferItem.value as readonly T[];
        if (!sourceItems || sourceItems.length === 0) {
            return;
        }

        // ターゲットディレクトリの決定
        let targetDir: string;
        if (!target && defaultTargetDir) {
            // ビューのルートにドロップされた場合
            targetDir = defaultTargetDir;
        } else if (target && isDirectory(target)) {
            // フォルダにドロップされた場合
            targetDir = getItemPath(target);
        } else if (target) {
            // ファイルにドロップされた場合は、その親ディレクトリに移動
            targetDir = path.dirname(getItemPath(target));
        } else {
            return;
        }

        // 操作の種類を決定（デフォルトは移動、Ctrlキー押下時はコピー）
        // VSCode APIでは修飾キーの検出が難しいため、デフォルトは移動とする
        const operation = DragDropOperation.Move;

        // ファイルの移動/コピー処理
        await this.performOperation(sourceItems, targetDir, operation, getItemPath, isDirectory);
    }

    /**
     * ドラッグ&ドロップ操作を実行
     */
    private async performOperation(
        sourceItems: readonly T[],
        targetDir: string,
        operation: DragDropOperation,
        getItemPath: (item: T) => string,
        isDirectory: (item: T) => boolean
    ): Promise<void> {
        for (const item of sourceItems) {
            const sourcePath = getItemPath(item);
            const fileName = path.basename(sourcePath);
            const targetPath = path.join(targetDir, fileName);

            // 同じディレクトリへの移動は無視
            if (path.dirname(sourcePath) === targetDir) {
                continue;
            }

            try {
                // ファイルが既に存在するかチェック
                if (await this.fileOperationService.exists(targetPath)) {
                    const answer = await vscode.window.showWarningMessage(
                        `${fileName} already exists. Overwrite?`,
                        'Overwrite',
                        'Skip'
                    );
                    if (answer !== 'Overwrite') {
                        continue;
                    }
                }

                if (operation === DragDropOperation.Copy) {
                    // コピー
                    await this.fileOperationService.copyFile(sourcePath, targetPath);
                } else {
                    // 移動
                    await this.fileOperationService.moveFile(sourcePath, targetPath);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to operate ${fileName}: ${error}`);
            }
        }
    }

    /**
     * ドロップ検証
     */
    validateDrop(
        target: T | undefined,
        sourceItems: readonly T[],
        getItemPath: (item: T) => string,
        isDirectory: (item: T) => boolean
    ): boolean {
        // ターゲットがundefinedの場合は許可（ルートにドロップ）
        if (!target) {
            return true;
        }

        const targetPath = getItemPath(target);

        // ソースアイテムの中にターゲットが含まれている場合は不許可
        for (const item of sourceItems) {
            const sourcePath = getItemPath(item);
            if (targetPath === sourcePath || targetPath.startsWith(sourcePath + path.sep)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 視覚的フィードバックを提供
     */
    getDropFeedback(
        target: T | undefined,
        isDirectory: (item: T) => boolean
    ): { message?: string; icon?: vscode.ThemeIcon } {
        if (!target) {
            return {
                message: 'Move to root folder',
                icon: new vscode.ThemeIcon('folder')
            };
        }

        if (isDirectory(target)) {
            return {
                message: 'Move to folder',
                icon: new vscode.ThemeIcon('folder')
            };
        }

        return {
            message: 'Move to parent folder',
            icon: new vscode.ThemeIcon('folder')
        };
    }
}
