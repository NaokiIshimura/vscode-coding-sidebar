import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// settings.jsonを設定するヘルパー関数
export async function setupSettingsJson(workspaceRoot: string): Promise<void> {
    const vscodeDir = path.join(workspaceRoot, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');

    try {
        // .vscodeディレクトリを作成（存在しない場合）
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        let settings: any = {};

        // 既存のsettings.jsonを読み込み
        if (fs.existsSync(settingsPath)) {
            try {
                const content = fs.readFileSync(settingsPath, 'utf8');
                settings = JSON.parse(content);
            } catch (error) {
                console.error('Failed to parse settings.json:', error);
            }
        }

        // デフォルト設定を追加
        if (!settings.hasOwnProperty('aiCodingSidebar.defaultRelativePath')) {
            settings['aiCodingSidebar.defaultRelativePath'] = '.claude';
        }

        // settings.jsonに書き込み
        const settingsContent = JSON.stringify(settings, null, 2);
        fs.writeFileSync(settingsPath, settingsContent, 'utf8');

        // ファイルを開く
        const document = await vscode.workspace.openTextDocument(settingsPath);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage('Created/updated settings.json');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create settings.json: ${error}`);
    }
}

// テンプレートを設定するヘルパー関数
export async function setupTemplate(context: vscode.ExtensionContext, workspaceRoot: string): Promise<void> {
    const templatesDir = path.join(workspaceRoot, '.vscode', 'ai-coding-sidebar', 'templates');
    const templatePath = path.join(templatesDir, 'task.md');

    try {
        // .vscode/ai-coding-sidebar/templatesディレクトリを作成（存在しない場合）
        if (!fs.existsSync(templatesDir)) {
            fs.mkdirSync(templatesDir, { recursive: true });
        }

        // テンプレートファイルが存在しない場合のみ作成
        if (!fs.existsSync(templatePath)) {
            // 拡張機能内のtemplates/task.mdから読み込む
            const extensionTemplatePath = path.join(context.extensionPath, 'templates', 'task.md');
            if (!fs.existsSync(extensionTemplatePath)) {
                throw new Error(`Template file not found: ${extensionTemplatePath}`);
            }
            const templateContent = fs.readFileSync(extensionTemplatePath, 'utf8');
            fs.writeFileSync(templatePath, templateContent, 'utf8');
        }

        // ファイルを開く
        const document = await vscode.workspace.openTextDocument(templatePath);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage('Template file opened. Please edit and save.');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create template file: ${error}`);
    }
}

// .claudeフォルダを設定するヘルパー関数
export async function setupClaudeFolder(workspaceRoot: string): Promise<void> {
    try {
        // .claudeフォルダを作成（存在しない場合）
        const claudeDir = path.join(workspaceRoot, '.claude');
        if (!fs.existsSync(claudeDir)) {
            fs.mkdirSync(claudeDir, { recursive: true });
        }

        // settings.jsonも更新
        await setupSettingsJson(workspaceRoot);

        // 設定を適用
        const config = vscode.workspace.getConfiguration('aiCodingSidebar');
        await config.update('defaultRelativePath', '.claude', vscode.ConfigurationTarget.Workspace);

        vscode.window.showInformationMessage('Created .claude folder and updated settings');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to configure .claude folder: ${error}`);
    }
}
