# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.4] - 2025-01-08

### Added
- **Create Branch from Directory**: Added context menu item to create git branches from directory names
  - Right-click any directory in Directory List to access "Create Branch" menu
  - Pre-fills branch name with the directory name for quick creation
  - Validates branch name and creates the branch using VS Code's Git extension
  - Automatically switches to the newly created branch
  - If the branch already exists, it will switch to that branch instead of creating a duplicate
  - Displays appropriate messages for both creation and switching scenarios

## [0.3.3] - 2025-01-13

### Changed
- **Directory List View Enhancement**: The opened directory is now displayed as a root node in the tree view
  - Previously: Only the contents of the directory were shown (e.g., `commands`, `tasks`)
  - Now: The directory itself is shown as a parent node with its contents nested underneath (e.g., `.claude` → `commands`, `tasks`)
  - Provides better visual context and hierarchy understanding
  - The root node displays the project-relative path and is expanded by default

## [0.3.2] - 2025-01-13

### Changed
- **View Title Enhancement**: Updated Directory List and Markdown List view titles to display project-relative paths instead of just folder names
  - Directory List now shows: `Directory List - <relative-path>` (e.g., `Directory List - .claude`, `Directory List - src`)
  - Markdown List now shows: `Markdown List - <relative-path>` (e.g., `Markdown List - .claude`, `Markdown List - src`)
  - Root directory displays as `.` for clarity
- **File Changes View**: Set default visibility to "collapsed" to reduce UI clutter on extension load

## [0.3.1] - 2025-01-13

### Added
- **Keyboard Shortcut**: Added `Cmd+Shift+A` (macOS) / `Ctrl+Shift+A` (Windows/Linux) to quickly focus the AI Coding Sidebar
- **Settings View Enhancement**: Added "Note" section in Settings view displaying keyboard shortcuts
- **Directory Creation Helper**: When the configured default relative path does not exist, a "Create directory" button is now displayed in Directory List
  - Click the button to create the directory automatically
  - The directory is created recursively if parent directories don't exist
  - After creation, the directory contents are displayed immediately

### Changed
- **Directory List Behavior**: Instead of falling back to workspace root when the default path doesn't exist, the extension now prompts users to create the missing directory

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

[0.3.4]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.2.6...v0.3.0
[0.2.6]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.1.0...v0.2.5
[0.1.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/releases/tag/v0.0.1
