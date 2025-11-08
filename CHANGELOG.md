# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.7] - 2025-11-08

### Added
- **Markdown Editor View**: Added a new sidebar view for editing Markdown files directly in the extension
  - Automatically displays when selecting a Markdown file in Markdown List
  - Edit Markdown content in a dedicated textarea editor
  - Save files with `Cmd+S` / `Ctrl+S` keyboard shortcut
  - Shows the file path in the header for context
  - Positioned below Markdown List for easy access
  - Provides a seamless workflow for editing AI coding instructions without leaving the sidebar

## [0.3.6] - 2025-11-08

### Fixed
- **Markdown List Refresh**: Fixed refresh button not updating file list in Markdown List view
  - The refresh command now properly refreshes both Directory List and Markdown List views
  - Resolved issue where clicking the refresh button in Markdown List view had no effect
- **Auto-Refresh on File System Changes**: Fixed file system watcher not activating on initial load
  - File watcher listeners are now registered in provider constructors instead of during setup
  - Views now automatically reflect external file/directory additions and deletions (via Explorer, terminal, etc.)
  - Both Directory List and Markdown List views update automatically when files are changed outside the extension
- **View Updates After Extension Commands**: Improved view refresh behavior after file operations
  - Create Markdown File command now refreshes both Directory List and Markdown List views
  - Rename command now refreshes both views to reflect directory structure changes

### Added
- **Auto-Create Markdown File in New Directory**: Add Directory command now automatically creates a timestamped markdown file
  - After creating a new directory, a markdown file is automatically created inside it
  - The file is automatically opened in the editor for immediate use
  - Provides a seamless workflow for organizing AI coding tasks

### Changed
- **Default Relative Path**: Changed default value from empty string to ".ai/tasks"
  - New installations will automatically open the ".ai/tasks" directory by default
  - Provides better out-of-box experience for AI coding workflows
- **Command Name Update**: Renamed "Add Folder" to "Add Directory" for consistency
- **Timestamp Locale**: Changed timestamp format to use system locale instead of hard-coded Japanese format
  - Markdown file creation now uses `toLocaleString()` to respect user's system locale settings
  - Improves internationalization support

## [0.3.5] - 2025-11-08

### Added
- **Shortcut Menu in Settings View**: Added a new "Shortcut" section in the Settings view for quick access to common actions
  - **Open Terminal**: Quickly toggle the integrated terminal in VS Code with a status message
  - **Checkout Default Branch**: Automatically switch to the default branch (main/master/develop) with intelligent detection
  - **Git Pull**: Pull the latest changes from the remote repository with progress feedback
  - The Shortcut menu provides a centralized location for frequently used Git and workspace actions
  - Positioned between Workspace and Note sections in the Settings view


## [0.3.4] - 2025-01-08

### Added
- **Checkout Branch from Directory**: Added context menu item to checkout git branches using directory names
  - Right-click any directory in Directory List to access "Checkout Branch" menu
  - Automatically uses the directory name as the branch name
  - Validates the directory name for git branch compatibility
  - Creates the branch using VS Code's Git extension if it doesn't exist
  - Switches to the branch if it already exists
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

[0.3.7]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.6...v0.3.7
[0.3.6]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.2.6...v0.3.0
[0.2.6]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.1.0...v0.2.5
[0.1.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/releases/tag/v0.0.1
