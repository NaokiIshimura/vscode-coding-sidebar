import { IExplorerManager } from '../interfaces/IExplorerManager';
import { IFileOperationService } from '../interfaces/IFileOperationService';
import { IClipboardManager } from '../interfaces/IClipboardManager';
import { IMultiSelectionManager } from '../interfaces/IMultiSelectionManager';
import { FileOperationService } from './FileOperationService';
import { ClipboardManager } from './ClipboardManager';
import { MultiSelectionManager } from './MultiSelectionManager';

/**
 * エクスプローラー統合管理の実装
 */
export class ExplorerManager implements IExplorerManager {
    private fileOperationService: IFileOperationService;
    private clipboardManager: IClipboardManager;
    private selectionManager: IMultiSelectionManager;

    constructor() {
        this.fileOperationService = new FileOperationService();
        this.clipboardManager = new ClipboardManager(this.fileOperationService);
        this.selectionManager = new MultiSelectionManager();
    }

    /**
     * ファイル操作サービスを取得
     */
    getFileOperationService(): IFileOperationService {
        return this.fileOperationService;
    }

    /**
     * クリップボードマネージャーを取得
     */
    getClipboardManager(): IClipboardManager {
        return this.clipboardManager;
    }

    /**
     * 選択マネージャーを取得
     */
    getSelectionManager(): IMultiSelectionManager {
        return this.selectionManager;
    }

    /**
     * パスをクリップボードにコピー
     */
    async copyToClipboard(paths: string[]): Promise<void> {
        await this.clipboardManager.copy(paths);
    }

    /**
     * パスをクリップボードに切り取り
     */
    async cutToClipboard(paths: string[]): Promise<void> {
        await this.clipboardManager.cut(paths);
    }

    /**
     * クリップボードから貼り付け
     */
    async pasteFromClipboard(targetDir: string): Promise<void> {
        await this.clipboardManager.paste(targetDir);
    }

    /**
     * 選択されたアイテムをコピー
     */
    async copySelected(): Promise<void> {
        const selectedPaths = this.selectionManager.getSelectedPaths();
        if (selectedPaths.length === 0) {
            throw new Error('No item is selected');
        }
        await this.clipboardManager.copy(selectedPaths);
    }

    /**
     * 選択されたアイテムを切り取り
     */
    async cutSelected(): Promise<void> {
        const selectedPaths = this.selectionManager.getSelectedPaths();
        if (selectedPaths.length === 0) {
            throw new Error('No item is selected');
        }
        await this.clipboardManager.cut(selectedPaths);
    }

    /**
     * 選択されたアイテムを削除
     */
    async deleteSelected(): Promise<void> {
        const selectedPaths = this.selectionManager.getSelectedPaths();
        if (selectedPaths.length === 0) {
            throw new Error('No item is selected');
        }
        await this.fileOperationService.deleteFiles(selectedPaths);
        this.selectionManager.clearSelection();
    }
}
