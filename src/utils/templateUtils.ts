import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// テンプレート種別
export type TemplateType = 'prompt' | 'task' | 'spec';

// テンプレートを読み込んで変数を置換する関数
export function loadTemplate(
    context: vscode.ExtensionContext,
    variables: { [key: string]: string },
    templateType: TemplateType = 'prompt'
): string {
    let templatePath: string;
    const templateFileName = `${templateType}.md`;

    // 1. ワークスペースの.vscode/ai-coding-sidebar/templates/[templateType].mdを優先
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
        const vscodeTemplatePath = path.join(workspaceRoot, '.vscode', 'ai-coding-sidebar', 'templates', templateFileName);
        if (fs.existsSync(vscodeTemplatePath)) {
            templatePath = vscodeTemplatePath;
        } else {
            // 2. 拡張機能内の[templateType].mdをフォールバック
            templatePath = path.join(context.extensionPath, 'templates', templateFileName);
        }
    } else {
        templatePath = path.join(context.extensionPath, 'templates', templateFileName);
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
