import { ClipboardData, ClipboardOperation } from '../types';

/**
 * クリップボード管理のインターフェース
 */
export interface IClipboardManager {
    // クリップボード操作
    copy(paths: string[]): Promise<void>;
    cut(paths: string[]): Promise<void>;
    paste(targetDir: string): Promise<void>;
    clear(): void;

    // クリップボード状態
    hasData(): boolean;
    getData(): ClipboardData | undefined;
    getOperation(): ClipboardOperation | undefined;

    // システムクリップボード統合
    copyToSystemClipboard(paths: string[]): Promise<void>;
    pasteFromSystemClipboard(targetDir: string): Promise<void>;

    // 検証
    canPaste(targetDir: string): boolean;
}
