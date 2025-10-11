import { FileOperationResult, FileStats, OperationProgress } from '../types';

/**
 * ファイル操作サービスのインターフェース
 */
export interface IFileOperationService {
    // 基本的なCRUD操作
    createFile(path: string, content?: string): Promise<FileOperationResult>;
    createDirectory(path: string): Promise<FileOperationResult>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<FileOperationResult>;
    deleteFile(path: string): Promise<FileOperationResult>;
    deleteDirectory(path: string, recursive?: boolean): Promise<FileOperationResult>;
    renameFile(oldPath: string, newPath: string): Promise<FileOperationResult>;
    copyFile(sourcePath: string, destPath: string): Promise<FileOperationResult>;
    moveFile(sourcePath: string, destPath: string): Promise<FileOperationResult>;

    // バッチ操作
    deleteFiles(paths: string[]): Promise<FileOperationResult[]>;
    copyFiles(sources: string[], destDir: string): Promise<FileOperationResult[]>;
    moveFiles(sources: string[], destDir: string): Promise<FileOperationResult[]>;

    // ファイル情報
    getStats(path: string): Promise<FileStats>;
    exists(path: string): Promise<boolean>;

    // バリデーション
    validatePath(path: string): boolean;
    validateFileName(name: string): boolean;

    // 進捗レポート用のイベントエミッター
    onProgress?: (progress: OperationProgress) => void;
}
