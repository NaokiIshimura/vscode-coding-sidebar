import { IMultiSelectionManager } from '../interfaces/IMultiSelectionManager';
import { SelectionState } from '../types';

/**
 * 複数選択管理の実装
 */
export class MultiSelectionManager implements IMultiSelectionManager {
    private state: SelectionState = {
        selectedPaths: [],
        lastSelectedPath: undefined,
        anchorPath: undefined
    };

    public onSelectionChanged?: (paths: string[]) => void;

    /**
     * パスを選択
     */
    select(path: string): void {
        if (!this.isSelected(path)) {
            this.state.selectedPaths.push(path);
            this.state.lastSelectedPath = path;
            this.notifyChange();
        }
    }

    /**
     * パスの選択を解除
     */
    deselect(path: string): void {
        const index = this.state.selectedPaths.indexOf(path);
        if (index !== -1) {
            this.state.selectedPaths.splice(index, 1);
            this.notifyChange();
        }
    }

    /**
     * パスの選択をトグル
     */
    toggleSelection(path: string): void {
        if (this.isSelected(path)) {
            this.deselect(path);
        } else {
            this.select(path);
        }
    }

    /**
     * 範囲選択（Shift+Click用）
     */
    selectRange(startPath: string, endPath: string): void {
        // アンカーポイントを設定
        if (!this.state.anchorPath) {
            this.state.anchorPath = startPath;
        }

        // 範囲選択のロジックはツリー構造に依存するため、
        // 実際の実装はTreeDataProviderで行う
        this.select(startPath);
        this.select(endPath);
        this.state.lastSelectedPath = endPath;
    }

    /**
     * すべて選択
     */
    selectAll(paths: string[]): void {
        this.state.selectedPaths = [...paths];
        this.state.lastSelectedPath = paths.length > 0 ? paths[paths.length - 1] : undefined;
        this.notifyChange();
    }

    /**
     * 選択をクリア
     */
    clearSelection(): void {
        this.state.selectedPaths = [];
        this.state.lastSelectedPath = undefined;
        this.state.anchorPath = undefined;
        this.notifyChange();
    }

    /**
     * パスが選択されているかチェック
     */
    isSelected(path: string): boolean {
        return this.state.selectedPaths.includes(path);
    }

    /**
     * 選択されたパスを取得
     */
    getSelectedPaths(): string[] {
        return [...this.state.selectedPaths];
    }

    /**
     * 選択数を取得
     */
    getSelectionCount(): number {
        return this.state.selectedPaths.length;
    }

    /**
     * 選択があるかチェック
     */
    hasSelection(): boolean {
        return this.state.selectedPaths.length > 0;
    }

    /**
     * 選択状態を取得
     */
    getState(): SelectionState {
        return {
            selectedPaths: [...this.state.selectedPaths],
            lastSelectedPath: this.state.lastSelectedPath,
            anchorPath: this.state.anchorPath
        };
    }

    /**
     * 選択状態を設定
     */
    setState(state: SelectionState): void {
        this.state = {
            selectedPaths: [...state.selectedPaths],
            lastSelectedPath: state.lastSelectedPath,
            anchorPath: state.anchorPath
        };
        this.notifyChange();
    }

    /**
     * 変更を通知
     */
    private notifyChange(): void {
        if (this.onSelectionChanged) {
            this.onSelectionChanged(this.getSelectedPaths());
        }
    }
}
