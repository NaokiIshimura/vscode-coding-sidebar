import { IFileOperationService } from './IFileOperationService';
import { IClipboardManager } from './IClipboardManager';
import { IMultiSelectionManager } from './IMultiSelectionManager';

/**
 * エクスプローラー統合管理のインターフェース
 */
export interface IExplorerManager {
    // サービスへのアクセス
    getFileOperationService(): IFileOperationService;
    getClipboardManager(): IClipboardManager;
    getSelectionManager(): IMultiSelectionManager;

    // 統合操作
    copyToClipboard(paths: string[]): Promise<void>;
    cutToClipboard(paths: string[]): Promise<void>;
    pasteFromClipboard(targetDir: string): Promise<void>;

    // 選択とクリップボードの統合
    copySelected(): Promise<void>;
    cutSelected(): Promise<void>;
    deleteSelected(): Promise<void>;
}
