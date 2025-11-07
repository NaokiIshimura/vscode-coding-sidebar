# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-01-12

### Removed
- **Workspace Explorer View**: Removed the redundant workspace explorer view to simplify the extension
  - Removed `workspaceExplorer` view definition
  - Removed copy/cut/paste/searchInWorkspace commands that were only used by this view
  - Removed all menu items and keybindings associated with the workspace explorer
  - Removed WorkspaceExplorerProvider class (374 lines)
  - **Code reduction**: 687 lines removed
  - Core features (Directory List, Markdown List, File Changes) remain unchanged

## [0.2.6] - 2025-01-11

### Changed
- **Error Message Internationalization**: Converted remaining Japanese error messages to English
  - ContextMenuManager operation failure messages
  - DragDropHandler file operation error messages
  - KeyboardShortcutHandler operation failure messages

## [0.2.5] - 2025-01-11

### Changed
- **UI Internationalization**: Converted all user-facing messages from Japanese to English
  - Information, error, and warning messages
  - Input prompts, quick picks, and confirmation dialogs
  - Tooltips, status bar, and settings labels
  - View titles (Directory List, Markdown List, Explorer)

## [0.1.0] - 2025-01-11

### Added
- **Workspace Explorer**: New view displaying the entire project in tree format
- **File Icon Display**: Automatically displays 50+ icons based on file type
  - Supports major formats: TypeScript, JavaScript, JSON, Markdown, CSS, HTML, image files, etc.
  - Toggle icon display with `fileListExtension.showFileIcons` setting
- **Sort Functionality**: Sort by name, type, size, or modified time
  - Select sort criteria with `fileListExtension.sortBy` setting
  - Choose ascending/descending order with `fileListExtension.sortOrder` setting
- **Hidden Files Display**: Toggle display of hidden files and folders
  - Controlled by `fileListExtension.showHidden` setting
- **Auto-refresh Settings**: Enable/disable auto-refresh on file system changes
  - Controlled by `fileListExtension.autoRefresh` setting
  - Can be disabled for performance optimization in large projects
- **File Operations**:
  - Move files and folders via drag & drop
  - Copy, cut, paste functionality (keyboard shortcuts: Ctrl+C/X/V, Cmd+C/X/V)
  - Rename (F2 key support)
  - Delete (Delete key support)
- **Search Functionality**: Search files within workspace
- **Git Changed Files**: List modified files and review diffs
  - Files grouped by directory

### Improved
- **Performance Optimization**: Implemented caching functionality
  - Added caching to FileListProvider, FileDetailsProvider, and WorkspaceExplorerProvider
  - Reduced unnecessary directory reads
  - Improved performance for large projects
- **Configuration Management**: Implemented ConfigurationProvider service
  - Centralized management of all settings
  - Settings change monitoring functionality
- **Service-Oriented Architecture**:
  - FileOperationService: Centralized file operations management
  - SearchService: Provides search functionality
  - DragDropHandler: Manages drag & drop processing

### Changed
- **Documentation**: Major update to README.md
  - Organized features by category (display features, file operations, customization features)
  - Added detailed settings section
  - Documented all setting items with descriptions and default values
  - Added JSON code examples for settings

### Fixed
- Fixed `modifiedDate` property reference error during file name sorting (unified to `modified`)

## [0.0.1] - 2024-09-27

### Added
- Initial release
- **Folder Tree Pane**: Display folders only and navigate hierarchical structure
- **File List Pane**: Display files and subfolders within selected folder
- **Relative Path Settings**: Specify default folder with relative path from workspace root
- **Navigate to Parent Folder**: Easily move to upper folder from file list pane
- **Copy Relative Path**: Right-click file to copy relative path from workspace to clipboard
- **Create Files and Folders**: Easily create new files and folders
- **Template Feature**: Customize initial file content with `templates/file.md`
- **Workspace Settings**: Easily create and edit `.vscode/settings.json`
- **Automated Build & Release**: Automated build and release via GitHub Actions

[0.3.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.2.6...v0.3.0
[0.2.6]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.1.0...v0.2.5
[0.1.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/releases/tag/v0.0.1
