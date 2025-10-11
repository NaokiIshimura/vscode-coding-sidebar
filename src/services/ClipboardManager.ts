import * as vscode from 'vscode';
import * as path from 'path';
import { IClipboardManager } from '../interfaces/IClipboardManager';
import { IFileOperationService } from '../interfaces/IFileOperationService';
import { ClipboardData, ClipboardOperation, ClipboardItem } from '../types';

/**
 * クリップボード管理の実装
 */
export class ClipboardManager implements IClipboardManager {
    private clipboardData?: ClipboardData;

    constructor(private fileOperationService: IFileOperationService) {}

    /**
     * ファイル/フォルダをコピー
     */
    async copy(paths: string[]): Promise<void> {
        this.clipboardData = {
            items: paths.map(p => ({
                path: p,
                isDirectory: false, // 後で判定
                name: path.basename(p)
            })),
            operation: ClipboardOperation.Copy,
            timestamp: Date.now()
        };

        // ディレクトリかどうかを判定
        for (const item of this.clipboardData.items) {
            try {
                const stats = await this.fileOperationService.getStats(item.path);
                item.isDirectory = stats.isDirectory;
            } catch {
                // エラーの場合はファイルと仮定
                item.isDirectory = false;
            }
        }
    }

    /**
     * ファイル/フォルダを切り取り
     */
    async cut(paths: string[]): Promise<void> {
        this.clipboardData = {
            items: paths.map(p => ({
                path: p,
                isDirectory: false, // 後で判定
                name: path.basename(p)
            })),
            operation: ClipboardOperation.Cut,
            timestamp: Date.now()
        };

        // ディレクトリかどうかを判定
        for (const item of this.clipboardData.items) {
            try {
                const stats = await this.fileOperationService.getStats(item.path);
                item.isDirectory = stats.isDirectory;
            } catch {
                // エラーの場合はファイルと仮定
                item.isDirectory = false;
            }
        }
    }

    /**
     * クリップボードの内容を貼り付け
     */
    async paste(targetDir: string): Promise<void> {
        if (!this.clipboardData) {
            throw new Error('クリップボードが空です');
        }

        if (!this.canPaste(targetDir)) {
            throw new Error('この場所に貼り付けできません');
        }

        const sources = this.clipboardData.items.map(item => item.path);

        if (this.clipboardData.operation === ClipboardOperation.Copy) {
            // コピー操作
            await this.fileOperationService.copyFiles(sources, targetDir);
        } else {
            // 切り取り操作（移動）
            await this.fileOperationService.moveFiles(sources, targetDir);
            // 切り取り後はクリップボードをクリア
            this.clear();
        }
    }

    /**
     * クリップボードをクリア
     */
    clear(): void {
        this.clipboardData = undefined;
    }

    /**
     * クリップボードにデータがあるかチェック
     */
    hasData(): boolean {
        return this.clipboardData !== undefined;
    }

    /**
     * クリップボードデータを取得
     */
    getData(): ClipboardData | undefined {
        return this.clipboardData;
    }

    /**
     * クリップボード操作を取得
     */
    getOperation(): ClipboardOperation | undefined {
        return this.clipboardData?.operation;
    }

    /**
     * システムクリップボードにコピー
     */
    async copyToSystemClipboard(paths: string[]): Promise<void> {
        // パスをテキストとしてシステムクリップボードにコピー
        const pathsText = paths.join('\n');
        await vscode.env.clipboard.writeText(pathsText);
    }

    /**
     * システムクリップボードから貼り付け
     */
    async pasteFromSystemClipboard(targetDir: string): Promise<void> {
        // システムクリップボードからテキストを取得
        const text = await vscode.env.clipboard.readText();

        if (!text) {
            throw new Error('クリップボードが空です');
        }

        // 改行で分割してパスのリストを作成
        const paths = text.split('\n').filter(p => p.trim() !== '');

        // パスの存在確認
        const validPaths: string[] = [];
        for (const p of paths) {
            if (await this.fileOperationService.exists(p)) {
                validPaths.push(p);
            }
        }

        if (validPaths.length === 0) {
            throw new Error('有効なパスが見つかりませんでした');
        }

        // コピー操作として貼り付け
        await this.copy(validPaths);
        await this.paste(targetDir);
    }

    /**
     * 貼り付け可能かチェック
     */
    canPaste(targetDir: string): boolean {
        if (!this.clipboardData) {
            return false;
        }

        // ターゲットがディレクトリかチェック
        try {
            const stats = require('fs').statSync(targetDir);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }
}
