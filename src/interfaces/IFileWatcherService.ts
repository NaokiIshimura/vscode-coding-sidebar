import * as vscode from 'vscode';

/**
 * ファイル変更イベントのリスナー型
 */
export type FileChangeListener = (uri: vscode.Uri) => void;

/**
 * ファイルウォッチャーサービスのインターフェース
 */
export interface IFileWatcherService extends vscode.Disposable {
    /**
     * ファイル変更リスナーを登録
     * @param id リスナーの識別子
     * @param listener ファイル変更時のコールバック
     */
    registerListener(id: string, listener: FileChangeListener): void;

    /**
     * リスナーの登録を解除
     * @param id リスナーの識別子
     */
    unregisterListener(id: string): void;

    /**
     * 特定のリスナーを有効化
     * @param id リスナーの識別子
     */
    enableListener(id: string): void;

    /**
     * 特定のリスナーを無効化
     * @param id リスナーの識別子
     */
    disableListener(id: string): void;

    /**
     * すべてのリスナーを有効化
     */
    enableAllListeners(): void;

    /**
     * すべてのリスナーを無効化
     */
    disableAllListeners(): void;

    /**
     * ウォッチャーが有効かどうかを確認
     */
    isWatcherActive(): boolean;
}
