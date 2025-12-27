import * as vscode from 'vscode';

/**
 * ターミナル出力イベントのリスナー型
 */
export type TerminalOutputListener = (data: string) => void;

/**
 * ターミナルサービスのインターフェース
 */
export interface ITerminalService extends vscode.Disposable {
    /**
     * ターミナルセッションを作成
     * @param cwd 作業ディレクトリ（オプション）
     * @returns セッションID
     */
    createSession(cwd?: string): Promise<string>;

    /**
     * ターミナルセッションを終了
     * @param sessionId セッションID
     */
    killSession(sessionId: string): void;

    /**
     * ターミナルにデータを書き込む
     * @param sessionId セッションID
     * @param data 入力データ
     */
    write(sessionId: string, data: string): void;

    /**
     * 出力リスナーを登録
     * @param sessionId セッションID
     * @param callback 出力時のコールバック
     * @returns 登録解除用のDisposable
     */
    onOutput(sessionId: string, callback: TerminalOutputListener): vscode.Disposable;

    /**
     * ターミナルをリサイズ
     * @param sessionId セッションID
     * @param cols 列数
     * @param rows 行数
     */
    resize(sessionId: string, cols: number, rows: number): void;

    /**
     * node-ptyが利用可能かどうかを確認
     */
    isAvailable(): boolean;
}
