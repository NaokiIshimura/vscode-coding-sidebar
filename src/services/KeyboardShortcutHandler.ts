import * as vscode from 'vscode';
import { IExplorerManager } from '../interfaces/IExplorerManager';

/**
 * キーボードショートカットの種類
 */
export enum ShortcutType {
    Copy = 'copy',
    Cut = 'cut',
    Paste = 'paste',
    Delete = 'delete',
    Rename = 'rename',
    SelectAll = 'selectAll',
    Refresh = 'refresh',
    NewFile = 'newFile',
    NewFolder = 'newFolder'
}

/**
 * キーボードショートカットハンドラー
 */
export class KeyboardShortcutHandler {
    private shortcuts: Map<ShortcutType, () => Promise<void>>;

    constructor(
        private explorerManager: IExplorerManager,
        private context: vscode.ExtensionContext
    ) {
        this.shortcuts = new Map();
        this.initializeShortcuts();
    }

    /**
     * ショートカットを初期化
     */
    private initializeShortcuts(): void {
        // コピー (Ctrl+C / Cmd+C)
        this.shortcuts.set(ShortcutType.Copy, async () => {
            await this.explorerManager.copySelected();
        });

        // 切り取り (Ctrl+X / Cmd+X)
        this.shortcuts.set(ShortcutType.Cut, async () => {
            await this.explorerManager.cutSelected();
        });

        // 貼り付け (Ctrl+V / Cmd+V)
        this.shortcuts.set(ShortcutType.Paste, async () => {
            // 貼り付け先の決定ロジックは呼び出し側で実装
        });

        // 削除 (Delete)
        this.shortcuts.set(ShortcutType.Delete, async () => {
            await this.explorerManager.deleteSelected();
        });

        // リネーム (F2)
        this.shortcuts.set(ShortcutType.Rename, async () => {
            // リネームロジックは呼び出し側で実装
        });

        // 全選択 (Ctrl+A / Cmd+A)
        this.shortcuts.set(ShortcutType.SelectAll, async () => {
            // 全選択ロジックは呼び出し側で実装
        });

        // 更新 (F5)
        this.shortcuts.set(ShortcutType.Refresh, async () => {
            // 更新ロジックは呼び出し側で実装
        });

        // 新規ファイル (Ctrl+N)
        this.shortcuts.set(ShortcutType.NewFile, async () => {
            // 新規ファイル作成ロジックは呼び出し側で実装
        });

        // 新規フォルダ (Ctrl+Shift+N)
        this.shortcuts.set(ShortcutType.NewFolder, async () => {
            // 新規フォルダ作成ロジックは呼び出し側で実装
        });
    }

    /**
     * ショートカットを実行
     */
    async execute(type: ShortcutType): Promise<void> {
        const handler = this.shortcuts.get(type);
        if (handler) {
            try {
                await handler();
            } catch (error) {
                vscode.window.showErrorMessage(`Operation failed: ${error}`);
            }
        }
    }

    /**
     * カスタムショートカットを登録
     */
    registerCustomShortcut(type: ShortcutType, handler: () => Promise<void>): void {
        this.shortcuts.set(type, handler);
    }

    /**
     * ショートカットが登録されているかチェック
     */
    hasShortcut(type: ShortcutType): boolean {
        return this.shortcuts.has(type);
    }

    /**
     * すべてのショートカットをクリア
     */
    clearAllShortcuts(): void {
        this.shortcuts.clear();
    }
}
