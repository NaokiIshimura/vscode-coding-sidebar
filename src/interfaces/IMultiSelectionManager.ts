import { SelectionState } from '../types';

/**
 * 複数選択管理のインターフェース
 */
export interface IMultiSelectionManager {
    // 選択操作
    select(path: string): void;
    deselect(path: string): void;
    toggleSelection(path: string): void;
    selectRange(startPath: string, endPath: string): void;
    selectAll(paths: string[]): void;
    clearSelection(): void;

    // 選択状態
    isSelected(path: string): boolean;
    getSelectedPaths(): string[];
    getSelectionCount(): number;
    hasSelection(): boolean;

    // 選択状態の管理
    getState(): SelectionState;
    setState(state: SelectionState): void;

    // イベント
    onSelectionChanged?: (paths: string[]) => void;
}
