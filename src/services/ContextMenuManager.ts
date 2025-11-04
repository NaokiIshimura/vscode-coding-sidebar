import * as vscode from 'vscode';
import { IExplorerManager } from '../interfaces/IExplorerManager';

/**
 * コンテキストメニュー項目の種類
 */
export enum MenuItemType {
    Copy = 'copy',
    Cut = 'cut',
    Paste = 'paste',
    Delete = 'delete',
    Rename = 'rename',
    NewFile = 'newFile',
    NewFolder = 'newFolder',
    CopyPath = 'copyPath',
    CopyRelativePath = 'copyRelativePath',
    Reveal = 'reveal',
    OpenInTerminal = 'openInTerminal'
}

/**
 * コンテキストメニュー項目
 */
export interface ContextMenuItem {
    type: MenuItemType;
    label: string;
    icon?: string;
    enabled: boolean;
    visible: boolean;
    handler: () => Promise<void>;
}

/**
 * コンテキストメニューマネージャー
 */
export class ContextMenuManager {
    private menuItems: Map<MenuItemType, ContextMenuItem>;

    constructor(private explorerManager: IExplorerManager) {
        this.menuItems = new Map();
        this.initializeMenuItems();
    }

    /**
     * メニュー項目を初期化
     */
    private initializeMenuItems(): void {
        // コピー
        this.menuItems.set(MenuItemType.Copy, {
            type: MenuItemType.Copy,
            label: 'コピー',
            icon: '$(copy)',
            enabled: true,
            visible: true,
            handler: async () => {
                await this.explorerManager.copySelected();
            }
        });

        // 切り取り
        this.menuItems.set(MenuItemType.Cut, {
            type: MenuItemType.Cut,
            label: '切り取り',
            icon: '$(scissors)',
            enabled: true,
            visible: true,
            handler: async () => {
                await this.explorerManager.cutSelected();
            }
        });

        // 貼り付け
        this.menuItems.set(MenuItemType.Paste, {
            type: MenuItemType.Paste,
            label: '貼り付け',
            icon: '$(clippy)',
            enabled: false, // クリップボードにデータがある場合のみ有効
            visible: true,
            handler: async () => {
                // 貼り付けロジックは呼び出し側で実装
            }
        });

        // 削除
        this.menuItems.set(MenuItemType.Delete, {
            type: MenuItemType.Delete,
            label: '削除',
            icon: '$(trash)',
            enabled: true,
            visible: true,
            handler: async () => {
                await this.explorerManager.deleteSelected();
            }
        });

        // リネーム
        this.menuItems.set(MenuItemType.Rename, {
            type: MenuItemType.Rename,
            label: '名前の変更',
            icon: '$(edit)',
            enabled: true,
            visible: true,
            handler: async () => {
                // リネームロジックは呼び出し側で実装
            }
        });

        // 新規ファイル
        this.menuItems.set(MenuItemType.NewFile, {
            type: MenuItemType.NewFile,
            label: 'ファイルを作成',
            icon: '$(new-file)',
            enabled: true,
            visible: true,
            handler: async () => {
                // 新規ファイル作成ロジックは呼び出し側で実装
            }
        });

        // 新規フォルダ
        this.menuItems.set(MenuItemType.NewFolder, {
            type: MenuItemType.NewFolder,
            label: 'フォルダを作成',
            icon: '$(new-folder)',
            enabled: true,
            visible: true,
            handler: async () => {
                // 新規フォルダ作成ロジックは呼び出し側で実装
            }
        });

        // パスをコピー
        this.menuItems.set(MenuItemType.CopyPath, {
            type: MenuItemType.CopyPath,
            label: 'パスをコピー',
            icon: '$(copy)',
            enabled: true,
            visible: true,
            handler: async () => {
                // パスコピーロジックは呼び出し側で実装
            }
        });

        // 相対パスをコピー
        this.menuItems.set(MenuItemType.CopyRelativePath, {
            type: MenuItemType.CopyRelativePath,
            label: '相対パスをコピー',
            icon: '$(copy)',
            enabled: true,
            visible: true,
            handler: async () => {
                // 相対パスコピーロジックは呼び出し側で実装
            }
        });
    }

    /**
     * メニュー項目を取得
     */
    getMenuItem(type: MenuItemType): ContextMenuItem | undefined {
        return this.menuItems.get(type);
    }

    /**
     * すべてのメニュー項目を取得
     */
    getAllMenuItems(): ContextMenuItem[] {
        return Array.from(this.menuItems.values());
    }

    /**
     * 表示可能なメニュー項目を取得
     */
    getVisibleMenuItems(): ContextMenuItem[] {
        return Array.from(this.menuItems.values()).filter(item => item.visible);
    }

    /**
     * 有効なメニュー項目を取得
     */
    getEnabledMenuItems(): ContextMenuItem[] {
        return Array.from(this.menuItems.values()).filter(item => item.enabled && item.visible);
    }

    /**
     * メニュー項目の有効/無効を設定
     */
    setMenuItemEnabled(type: MenuItemType, enabled: boolean): void {
        const item = this.menuItems.get(type);
        if (item) {
            item.enabled = enabled;
        }
    }

    /**
     * メニュー項目の表示/非表示を設定
     */
    setMenuItemVisible(type: MenuItemType, visible: boolean): void {
        const item = this.menuItems.get(type);
        if (item) {
            item.visible = visible;
        }
    }

    /**
     * コンテキストに応じてメニュー項目を更新
     */
    updateMenuItemsContext(context: {
        hasSelection: boolean;
        hasClipboardData: boolean;
        isDirectory: boolean;
        isReadOnly: boolean;
    }): void {
        // 貼り付けはクリップボードにデータがある場合のみ有効
        this.setMenuItemEnabled(MenuItemType.Paste, context.hasClipboardData && context.isDirectory);

        // コピー、切り取り、削除、リネームは選択がある場合のみ有効
        this.setMenuItemEnabled(MenuItemType.Copy, context.hasSelection);
        this.setMenuItemEnabled(MenuItemType.Cut, context.hasSelection && !context.isReadOnly);
        this.setMenuItemEnabled(MenuItemType.Delete, context.hasSelection && !context.isReadOnly);
        this.setMenuItemEnabled(MenuItemType.Rename, context.hasSelection && !context.isReadOnly);

        // 新規ファイル/フォルダはディレクトリの場合のみ有効
        this.setMenuItemEnabled(MenuItemType.NewFile, context.isDirectory && !context.isReadOnly);
        this.setMenuItemEnabled(MenuItemType.NewFolder, context.isDirectory && !context.isReadOnly);
    }

    /**
     * メニュー項目を実行
     */
    async executeMenuItem(type: MenuItemType): Promise<void> {
        const item = this.menuItems.get(type);
        if (item && item.enabled && item.visible) {
            try {
                await item.handler();
            } catch (error) {
                vscode.window.showErrorMessage(`Operation failed: ${error}`);
            }
        }
    }

    /**
     * カスタムメニュー項目を登録
     */
    registerCustomMenuItem(item: ContextMenuItem): void {
        this.menuItems.set(item.type, item);
    }
}
