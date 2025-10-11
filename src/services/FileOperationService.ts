import * as fs from 'fs';
import * as path from 'path';
import { IFileOperationService } from '../interfaces/IFileOperationService';
import {
    FileOperationResult,
    FileStats,
    FilePermissions,
    OperationProgress,
    FileOperationError
} from '../types';

/**
 * ファイル操作サービスの実装
 */
export class FileOperationService implements IFileOperationService {
    public onProgress?: (progress: OperationProgress) => void;

    /**
     * ファイルを作成
     */
    async createFile(filePath: string, content: string = ''): Promise<FileOperationResult> {
        try {
            // パスの検証
            if (!this.validatePath(filePath)) {
                throw FileOperationError.invalidPath(filePath);
            }

            // 既に存在するかチェック
            if (await this.exists(filePath)) {
                throw FileOperationError.alreadyExists(filePath);
            }

            // ディレクトリを作成（存在しない場合）
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // ファイルを作成
            fs.writeFileSync(filePath, content, 'utf8');

            return {
                success: true,
                message: `ファイルを作成しました: ${path.basename(filePath)}`
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error,
                message: `ファイルの作成に失敗しました: ${error}`
            };
        }
    }

    /**
     * ディレクトリを作成
     */
    async createDirectory(dirPath: string): Promise<FileOperationResult> {
        try {
            // パスの検証
            if (!this.validatePath(dirPath)) {
                throw FileOperationError.invalidPath(dirPath);
            }

            // 既に存在するかチェック
            if (await this.exists(dirPath)) {
                throw FileOperationError.alreadyExists(dirPath);
            }

            // ディレクトリを作成
            fs.mkdirSync(dirPath, { recursive: true });

            return {
                success: true,
                message: `フォルダを作成しました: ${path.basename(dirPath)}`
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error,
                message: `フォルダの作成に失敗しました: ${error}`
            };
        }
    }

    /**
     * ファイルを読み込み
     */
    async readFile(filePath: string): Promise<string> {
        try {
            if (!await this.exists(filePath)) {
                throw FileOperationError.notFound(filePath);
            }
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            throw error;
        }
    }

    /**
     * ファイルに書き込み
     */
    async writeFile(filePath: string, content: string): Promise<FileOperationResult> {
        try {
            if (!this.validatePath(filePath)) {
                throw FileOperationError.invalidPath(filePath);
            }

            fs.writeFileSync(filePath, content, 'utf8');

            return {
                success: true,
                message: `ファイルを保存しました: ${path.basename(filePath)}`
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error,
                message: `ファイルの保存に失敗しました: ${error}`
            };
        }
    }

    /**
     * ファイルを削除
     */
    async deleteFile(filePath: string): Promise<FileOperationResult> {
        try {
            if (!await this.exists(filePath)) {
                throw FileOperationError.notFound(filePath);
            }

            fs.unlinkSync(filePath);

            return {
                success: true,
                message: `ファイルを削除しました: ${path.basename(filePath)}`
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error,
                message: `ファイルの削除に失敗しました: ${error}`
            };
        }
    }

    /**
     * ディレクトリを削除
     */
    async deleteDirectory(dirPath: string, recursive: boolean = true): Promise<FileOperationResult> {
        try {
            if (!await this.exists(dirPath)) {
                throw FileOperationError.notFound(dirPath);
            }

            fs.rmSync(dirPath, { recursive, force: true });

            return {
                success: true,
                message: `フォルダを削除しました: ${path.basename(dirPath)}`
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error,
                message: `フォルダの削除に失敗しました: ${error}`
            };
        }
    }

    /**
     * ファイル/フォルダをリネーム
     */
    async renameFile(oldPath: string, newPath: string): Promise<FileOperationResult> {
        try {
            if (!await this.exists(oldPath)) {
                throw FileOperationError.notFound(oldPath);
            }

            if (await this.exists(newPath)) {
                throw FileOperationError.alreadyExists(newPath);
            }

            fs.renameSync(oldPath, newPath);

            return {
                success: true,
                message: `名前を変更しました: ${path.basename(newPath)}`
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error,
                message: `名前の変更に失敗しました: ${error}`
            };
        }
    }

    /**
     * ファイルをコピー
     */
    async copyFile(sourcePath: string, destPath: string): Promise<FileOperationResult> {
        try {
            if (!await this.exists(sourcePath)) {
                throw FileOperationError.notFound(sourcePath);
            }

            const stats = await this.getStats(sourcePath);

            if (stats.isDirectory) {
                return await this.copyDirectory(sourcePath, destPath);
            } else {
                // ディレクトリを作成（存在しない場合）
                const dir = path.dirname(destPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.copyFileSync(sourcePath, destPath);
            }

            return {
                success: true,
                message: `コピーしました: ${path.basename(destPath)}`
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error,
                message: `コピーに失敗しました: ${error}`
            };
        }
    }

    /**
     * ディレクトリを再帰的にコピー
     */
    private async copyDirectory(sourcePath: string, destPath: string): Promise<FileOperationResult> {
        try {
            // コピー先ディレクトリを作成
            fs.mkdirSync(destPath, { recursive: true });

            const entries = fs.readdirSync(sourcePath, { withFileTypes: true });

            for (const entry of entries) {
                const srcPath = path.join(sourcePath, entry.name);
                const dstPath = path.join(destPath, entry.name);

                if (entry.isDirectory()) {
                    await this.copyDirectory(srcPath, dstPath);
                } else {
                    fs.copyFileSync(srcPath, dstPath);
                }
            }

            return {
                success: true,
                message: `フォルダをコピーしました: ${path.basename(destPath)}`
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error,
                message: `フォルダのコピーに失敗しました: ${error}`
            };
        }
    }

    /**
     * ファイルを移動
     */
    async moveFile(sourcePath: string, destPath: string): Promise<FileOperationResult> {
        try {
            if (!await this.exists(sourcePath)) {
                throw FileOperationError.notFound(sourcePath);
            }

            // ディレクトリを作成（存在しない場合）
            const dir = path.dirname(destPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.renameSync(sourcePath, destPath);

            return {
                success: true,
                message: `移動しました: ${path.basename(destPath)}`
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error,
                message: `移動に失敗しました: ${error}`
            };
        }
    }

    /**
     * 複数ファイルを削除
     */
    async deleteFiles(paths: string[]): Promise<FileOperationResult[]> {
        const results: FileOperationResult[] = [];
        const total = paths.length;

        for (let i = 0; i < paths.length; i++) {
            const filePath = paths[i];
            const stats = await this.getStats(filePath);

            if (this.onProgress) {
                this.onProgress({
                    total,
                    completed: i,
                    current: path.basename(filePath),
                    percentage: (i / total) * 100
                });
            }

            let result: FileOperationResult;
            if (stats.isDirectory) {
                result = await this.deleteDirectory(filePath);
            } else {
                result = await this.deleteFile(filePath);
            }

            results.push(result);
        }

        if (this.onProgress) {
            this.onProgress({
                total,
                completed: total,
                percentage: 100
            });
        }

        return results;
    }

    /**
     * 複数ファイルをコピー
     */
    async copyFiles(sources: string[], destDir: string): Promise<FileOperationResult[]> {
        const results: FileOperationResult[] = [];
        const total = sources.length;

        for (let i = 0; i < sources.length; i++) {
            const sourcePath = sources[i];
            const fileName = path.basename(sourcePath);
            const destPath = path.join(destDir, fileName);

            if (this.onProgress) {
                this.onProgress({
                    total,
                    completed: i,
                    current: fileName,
                    percentage: (i / total) * 100
                });
            }

            const result = await this.copyFile(sourcePath, destPath);
            results.push(result);
        }

        if (this.onProgress) {
            this.onProgress({
                total,
                completed: total,
                percentage: 100
            });
        }

        return results;
    }

    /**
     * 複数ファイルを移動
     */
    async moveFiles(sources: string[], destDir: string): Promise<FileOperationResult[]> {
        const results: FileOperationResult[] = [];
        const total = sources.length;

        for (let i = 0; i < sources.length; i++) {
            const sourcePath = sources[i];
            const fileName = path.basename(sourcePath);
            const destPath = path.join(destDir, fileName);

            if (this.onProgress) {
                this.onProgress({
                    total,
                    completed: i,
                    current: fileName,
                    percentage: (i / total) * 100
                });
            }

            const result = await this.moveFile(sourcePath, destPath);
            results.push(result);
        }

        if (this.onProgress) {
            this.onProgress({
                total,
                completed: total,
                percentage: 100
            });
        }

        return results;
    }

    /**
     * ファイル統計情報を取得
     */
    async getStats(filePath: string): Promise<FileStats> {
        try {
            const stats = fs.statSync(filePath);
            const permissions = this.getPermissions(filePath);

            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
                permissions
            };
        } catch (error) {
            throw FileOperationError.notFound(filePath);
        }
    }

    /**
     * ファイル権限を取得
     */
    private getPermissions(filePath: string): FilePermissions {
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
            const readable = true;

            let writable = false;
            try {
                fs.accessSync(filePath, fs.constants.W_OK);
                writable = true;
            } catch {}

            let executable = false;
            try {
                fs.accessSync(filePath, fs.constants.X_OK);
                executable = true;
            } catch {}

            return { readable, writable, executable };
        } catch {
            return { readable: false, writable: false, executable: false };
        }
    }

    /**
     * ファイル/フォルダが存在するかチェック
     */
    async exists(filePath: string): Promise<boolean> {
        return fs.existsSync(filePath);
    }

    /**
     * パスを検証
     */
    validatePath(filePath: string): boolean {
        try {
            // 絶対パスかチェック
            if (!path.isAbsolute(filePath)) {
                return false;
            }

            // 不正な文字をチェック
            const baseName = path.basename(filePath);
            return this.validateFileName(baseName);
        } catch {
            return false;
        }
    }

    /**
     * ファイル名を検証
     */
    validateFileName(name: string): boolean {
        // 空文字チェック
        if (!name || name.trim() === '') {
            return false;
        }

        // 不正な文字をチェック（Windows/Mac/Linux共通）
        const invalidChars = /[<>:"|?*\\/]/;
        if (invalidChars.test(name)) {
            return false;
        }

        // 予約語チェック（Windows）
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        const upperName = name.toUpperCase();
        if (reservedNames.includes(upperName)) {
            return false;
        }

        return true;
    }
}
