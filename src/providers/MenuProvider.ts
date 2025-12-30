import * as vscode from 'vscode';
import { MenuItem } from './items/MenuItem';

export class MenuProvider implements vscode.TreeDataProvider<MenuItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MenuItem | undefined | null | void> = new vscode.EventEmitter<MenuItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MenuItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private _isInitialLoad: boolean = true;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MenuItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: MenuItem): Promise<MenuItem[]> {
        // Show loader on initial load
        if (this._isInitialLoad && !element) {
            this._isInitialLoad = false;
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (!element) {
            // ルートレベル: メニュー項目を返す
            return [
                // グローバル（親項目）
                new MenuItem(
                    'Global',
                    'User-level settings',
                    undefined,
                    new vscode.ThemeIcon('account'),
                    [
                        new MenuItem(
                            'Open User Settings',
                            'Open AI Coding Panel user settings',
                            {
                                command: 'aiCodingSidebar.openUserSettings',
                                title: 'Open User Settings'
                            },
                            new vscode.ThemeIcon('settings-gear')
                        )
                    ],
                    vscode.TreeItemCollapsibleState.Collapsed
                ),
                // ワークスペース（親項目）
                new MenuItem(
                    'Workspace',
                    'Workspace-level settings',
                    undefined,
                    new vscode.ThemeIcon('folder-opened'),
                    [
                        new MenuItem(
                            'Open Workspace Settings',
                            'Open AI Coding Panel workspace settings',
                            {
                                command: 'aiCodingSidebar.openWorkspaceSettings',
                                title: 'Open Workspace Settings'
                            },
                            new vscode.ThemeIcon('settings-gear')
                        ),
                        new MenuItem(
                            'Customize Template',
                            'Customize template for file creation',
                            {
                                command: 'aiCodingSidebar.setupTemplate',
                                title: 'Customize Template'
                            },
                            new vscode.ThemeIcon('file-text')
                        )
                    ],
                    vscode.TreeItemCollapsibleState.Collapsed
                ),
                // Shortcut（親項目）
                new MenuItem(
                    'Shortcut',
                    'Quick actions and shortcuts',
                    undefined,
                    new vscode.ThemeIcon('zap'),
                    [
                        new MenuItem(
                            'Open Terminal',
                            'Open integrated terminal in VSCode',
                            {
                                command: 'aiCodingSidebar.openTerminal',
                                title: 'Open Terminal'
                            },
                            new vscode.ThemeIcon('terminal')
                        ),
                        new MenuItem(
                            'Checkout Default Branch',
                            'Switch to the default branch (main/master)',
                            {
                                command: 'aiCodingSidebar.checkoutDefaultBranch',
                                title: 'Checkout Default Branch'
                            },
                            new vscode.ThemeIcon('git-branch')
                        ),
                        new MenuItem(
                            'Git Pull',
                            'Pull the latest changes from remote',
                            {
                                command: 'aiCodingSidebar.gitPull',
                                title: 'Git Pull'
                            },
                            new vscode.ThemeIcon('arrow-down')
                        ),
                        new MenuItem(
                            'Duplicate Workspace in New Window',
                            'Open a copy of this workspace in a new window',
                            {
                                command: 'workbench.action.duplicateWorkspaceInNewWindow',
                                title: 'Duplicate Workspace in New Window'
                            },
                            new vscode.ThemeIcon('multiple-windows')
                        )
                    ],
                    vscode.TreeItemCollapsibleState.Collapsed
                ),
                // Note（親項目）
                new MenuItem(
                    'Note',
                    'Keyboard shortcuts and tips',
                    undefined,
                    new vscode.ThemeIcon('info'),
                    [
                        new MenuItem(
                            'Focus Sidebar',
                            'Cmd+Shift+A (macOS) / Ctrl+Shift+A (Windows/Linux)',
                            undefined,
                            new vscode.ThemeIcon('keyboard')
                        ),
                        new MenuItem(
                            'New Task',
                            'Cmd+S (macOS) / Ctrl+S (Windows/Linux) - When sidebar is focused',
                            undefined,
                            new vscode.ThemeIcon('keyboard')
                        ),
                        new MenuItem(
                            'Create Markdown File',
                            'Cmd+M (macOS) / Ctrl+M (Windows/Linux) - When sidebar is focused',
                            undefined,
                            new vscode.ThemeIcon('keyboard')
                        )
                    ],
                    vscode.TreeItemCollapsibleState.Collapsed
                )
            ];
        } else {
            // 子レベル: 親項目の子要素を返す
            return element.children || [];
        }
    }
}
