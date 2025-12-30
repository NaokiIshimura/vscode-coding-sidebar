import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// テンプレートを読み込んで変数を置換する関数
export function loadTemplate(context: vscode.ExtensionContext, variables: { [key: string]: string }): string {
    let templatePath: string;

    // 1. ワークスペースの.vscode/ai-coding-sidebar/templates/task.mdを優先
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
        const vscodeTemplatePath = path.join(workspaceRoot, '.vscode', 'ai-coding-sidebar', 'templates', 'task.md');
        if (fs.existsSync(vscodeTemplatePath)) {
            templatePath = vscodeTemplatePath;
        } else {
            // 2. 拡張機能内のtask.mdをフォールバック
            templatePath = path.join(context.extensionPath, 'templates', 'task.md');
        }
    } else {
        templatePath = path.join(context.extensionPath, 'templates', 'task.md');
    }

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
    }

    let content = fs.readFileSync(templatePath, 'utf8');

    // 変数を置換
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, value);
    }

    return content;
}
