import * as fs from 'fs';
import * as path from 'path';
import { SearchOptions } from '../types';

/**
 * 検索結果
 */
export interface SearchResult {
    path: string;
    name: string;
    isDirectory: boolean;
    matches: boolean;
}

/**
 * 検索サービス
 */
export class SearchService {
    /**
     * ディレクトリ内を検索
     */
    async search(dirPath: string, options: SearchOptions): Promise<SearchResult[]> {
        const results: SearchResult[] = [];

        try {
            await this.searchRecursive(dirPath, options, results);
        } catch (error) {
            console.error('検索エラー:', error);
        }

        return results;
    }

    /**
     * 再帰的に検索
     */
    private async searchRecursive(
        dirPath: string,
        options: SearchOptions,
        results: SearchResult[]
    ): Promise<void> {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const isDirectory = entry.isDirectory();

                // 隠しファイルのチェック
                if (!options.includeHidden && entry.name.startsWith('.')) {
                    continue;
                }

                // パターンマッチング
                const matches = this.matchPattern(entry.name, options);

                results.push({
                    path: fullPath,
                    name: entry.name,
                    isDirectory,
                    matches
                });

                // ディレクトリの場合は再帰的に検索
                if (isDirectory) {
                    await this.searchRecursive(fullPath, options, results);
                }
            }
        } catch (error) {
            console.error(`ディレクトリの読み取りエラー: ${dirPath}`, error);
        }
    }

    /**
     * パターンマッチング
     */
    private matchPattern(name: string, options: SearchOptions): boolean {
        let pattern = options.pattern;
        let testName = name;

        // 大文字小文字を区別しない場合
        if (!options.caseSensitive) {
            pattern = pattern.toLowerCase();
            testName = testName.toLowerCase();
        }

        if (options.useRegex) {
            // 正規表現マッチング
            try {
                const regex = new RegExp(pattern, options.caseSensitive ? '' : 'i');
                return regex.test(name);
            } catch {
                // 正規表現が無効な場合は通常のマッチング
                return testName.includes(pattern);
            }
        } else {
            // ワイルドカードマッチング
            const regexPattern = this.wildcardToRegex(pattern);
            const regex = new RegExp(regexPattern, options.caseSensitive ? '' : 'i');
            return regex.test(name);
        }
    }

    /**
     * ワイルドカードを正規表現に変換
     */
    private wildcardToRegex(pattern: string): string {
        // エスケープが必要な特殊文字
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

        // * を .* に、? を . に変換
        return escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    }

    /**
     * ファイル内容を検索
     */
    async searchInFileContents(
        filePath: string,
        searchText: string,
        caseSensitive: boolean = false
    ): Promise<{ lineNumber: number; line: string; }[]> {
        const results: { lineNumber: number; line: string; }[] = [];

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            const searchPattern = caseSensitive ? searchText : searchText.toLowerCase();

            lines.forEach((line, index) => {
                const testLine = caseSensitive ? line : line.toLowerCase();
                if (testLine.includes(searchPattern)) {
                    results.push({
                        lineNumber: index + 1,
                        line: line.trim()
                    });
                }
            });
        } catch (error) {
            console.error(`ファイル内容の検索エラー: ${filePath}`, error);
        }

        return results;
    }

    /**
     * 検索結果をフィルタリング
     */
    filterResults(results: SearchResult[], includeDirectories: boolean = true): SearchResult[] {
        return results.filter(result => {
            if (!includeDirectories && result.isDirectory) {
                return false;
            }
            return result.matches;
        });
    }

    /**
     * 検索結果をソート
     */
    sortResults(
        results: SearchResult[],
        sortBy: 'name' | 'path' = 'name',
        ascending: boolean = true
    ): SearchResult[] {
        return results.sort((a, b) => {
            let comparison = 0;

            if (sortBy === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else {
                comparison = a.path.localeCompare(b.path);
            }

            return ascending ? comparison : -comparison;
        });
    }
}
