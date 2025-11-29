# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2025-11-30

### Added
- **Keyboard Shortcuts - Start Task**: Added `Cmd+S` / `Ctrl+S` keyboard shortcut to start a new task
  - Works when AI Coding Sidebar views (Tasks, Docs, Editor) are focused
  - Creates a new directory and timestamped markdown file for immediate task creation
  - Does not conflict with VSCode's save shortcut when sidebar is not focused
- **Keyboard Shortcuts - Create Markdown File**: Added `Cmd+M` / `Ctrl+M` keyboard shortcut to create new markdown file
  - Works when AI Coding Sidebar views (Tasks, Docs, Editor) are focused
  - Quickly creates a timestamped markdown file in the current directory
- **Menu - Keyboard Shortcut Notes**: Added shortcut descriptions to Menu > Note section
  - Shows "Start Task" shortcut (`Cmd+S` / `Ctrl+S`)
  - Shows "Create Markdown File" shortcut (`Cmd+M` / `Ctrl+M`)
  - Indicates shortcuts only work when sidebar is focused

## [0.5.9] - 2025-11-29

### Added
- **Editor View - Create Markdown File Button**: Added Create Markdown File button to Editor view title bar
  - Click the button to quickly create a new timestamped markdown file
  - Editor view is automatically focused after file creation for seamless workflow
- **Editor View - Keyboard Shortcut**: Added `Cmd+M` / `Ctrl+M` keyboard shortcut to create new markdown file
  - Works when Editor view is focused
  - Provides quick access to file creation without leaving the keyboard
  - Shortcut key descriptions added to placeholder text for discoverability

### Changed
- **GitHub Actions**: Refactored workflows into modular files
  - Split single release.yml into three separate workflows
  - `build-vsix.yml`: Reusable workflow for building VSIX package
  - `release-vsix.yml`: Upload VSIX to GitHub Release
  - `publish-marketplace.yml`: Publish to VS Code Marketplace

## [0.5.8] - 2025-11-22

### Added
- **Docs View - Settings Icon**: Added settings icon to Docs view title for quick access to sort configuration
  - Click the settings icon to open `Ai Coding Sidebar › Markdown List: Sort By` and `Ai Coding Sidebar › Markdown List: Sort Order` settings
  - Provides convenient access to customize file sorting preferences
- **Editor View - Settings Icon**: Added settings icon to Editor view title for quick access to run command configuration
  - Click the settings icon to open `Ai Coding Sidebar › Editor: Run Command` setting
  - Allows easy customization of the command executed by the Run button

## [0.5.7] - 2025-11-22

### Changed
- **Default Relative Path**: Changed default value from `.ai/tasks` to `.claude/tasks`
  - New installations will now use `.claude/tasks` as the default directory
  - Aligns with common AI coding tool conventions
  - Existing installations are not affected unless settings are reset

## [0.5.6] - 2025-11-21

### Added
- **Tasks View - Archive Feature**: Archive task directories to keep your workspace organized
  - Right-click a directory in Tasks view and select "Archive" to move it to the `archived` folder
  - The `archived` folder is automatically created in the default tasks path root if it doesn't exist
  - If a directory with the same name already exists in the archived folder, a timestamp is automatically added to avoid conflicts (format: `directoryname_YYYYMMDD_HHMMSS`)
  - Success messages inform you when directories are archived, including when names are modified due to conflicts
  - Helps maintain a clean workspace by moving completed or inactive tasks out of the main view while preserving history

## [0.5.5] - 2025-11-15

### Added
- **Editor View - Customizable Run Command**: Configure the command executed by the Run button
  - Added `aiCodingSidebar.editor.runCommand` setting
  - Use `${filePath}` as placeholder for the file path
  - Default command: `claude "read ${filePath} and save your report to the same directory as ${filePath}"`
  - Allows customization of the Run button behavior to fit your AI coding workflow

### Improved
- **Docs View - Auto-refresh**: Improved file change detection
  - Removed .gitignore-based file exclusion to ensure all files are monitored
  - Files in `.claude`, `.ai`, `.cline`, `.roo`, `.cursor`, `.copilot` directories are now properly detected
  - Automatically updates the file list when files are created, modified, or deleted in the current directory
  - No need to manually click the Refresh button anymore

## [0.5.4] - 2025-11-15

### Fixed
- **Editor View - Run Button**: Fixed extra newline issue when sending commands to terminal
  - Commands are now trimmed to remove any whitespace or newline characters
  - Added explicit command execution parameter to ensure immediate execution
  - Prevents unintended newlines in terminal when running tasks with Claude Code

## [0.5.3] - 2025-11-13

### Removed
- **File Changes View**: Removed the File Changes view from the sidebar
  - Removed `gitChanges` view definition from package.json
  - Removed `openGitFile`, `showGitDiff`, and `refreshGitChanges` commands
  - Removed Git-related menu items and view refresh button
  - Removed GitChangesProvider, GitFileItem, GitChange, and GitHeadContentProvider classes from extension.ts
  - Simplified the extension by removing ~520 lines of code
  - Users can still use VS Code's built-in Source Control view for Git operations

## [0.5.2] - 2025-11-13

### Added
- **Editor View - Auto-save**: Implemented automatic saving of edited content
  - Auto-saves when switching to another extension or sidebar view
  - Auto-saves before switching to a different file in Docs view
  - Restores the editing file when returning from another extension
  - Prevents data loss when navigating away from the Editor view
  - Maintains a seamless editing experience across extension switches

## [0.5.1] - 2025-11-13

### Added
- **Editor View - Run Button**: Added Run button to execute tasks directly from the Editor
  - Click the Run button to send `claude "read <file>"` command to the "AI Coding Sidebar" terminal
  - Automatically saves the file before running if there are unsaved changes
  - Commands are always sent to the dedicated "AI Coding Sidebar" terminal (creates it if it doesn't exist)
  - Button is positioned on the right side of the Editor header
  - Displays tooltip "Run task (Cmd+R / Ctrl+R)" on hover
- **Editor View - Keyboard Shortcut**: Added `Cmd+R` / `Ctrl+R` keyboard shortcut to run tasks
  - Same functionality as clicking the Run button
  - Auto-saves before running to ensure the latest content is used
  - Provides a quick way to send files to Claude without leaving the keyboard

### Changed
- **Editor View - UI Simplification**: Removed "Cmd+S / Ctrl+S to save" hint text
  - Cleaned up the Editor header for a simpler interface
  - Save functionality still works with the keyboard shortcut

## [0.5.0] - 2025-11-11

### Changed
- **View Names**: Renamed all views for better clarity and consistency
  - "Settings" → "Menu": More accurately reflects the menu-style navigation
  - "Directory List" → "Tasks": Better represents the task-oriented workflow
  - "Markdown List" → "Docs": Clearer indication of documentation/file management
  - "Markdown Editor" → "Editor": Simplified and more concise
- **Docs View - File Display**: Removed markdown-only filter to display all file types
  - Previously only showed `.md` files
  - Now displays all files in the selected directory
  - Provides more flexibility in managing different file types

### Added
- **Loading Indicators**: Added loader display for all views during initial content load
  - Menu view shows loading state on first display
  - Tasks view shows loading state on first display
  - Docs view shows loading state on first display
  - Editor view shows loading state on first display
  - File Changes view shows loading state on first display
  - Improves user experience by providing visual feedback during initialization

### Removed
- **Unused Settings**: Cleaned up configuration properties
  - Removed `sortBy`, `sortOrder`, `showHidden`, `viewMode`, `autoRefresh`, `showFileIcons`
  - Kept only actively used settings: `defaultRelativePath`, `markdownList.sortBy`, `markdownList.sortOrder`
  - Simplifies configuration and reduces maintenance overhead

### Technical
- Renamed all provider classes and variables for consistency with new view names
  - `WorkspaceSettingsProvider` → `MenuProvider`
  - `AiCodingSidebarProvider` → `TasksProvider`
  - `AiCodingSidebarDetailsProvider` → `DocsProvider`
  - `MarkdownEditorProvider` → `EditorProvider`

## [0.4.9] - 2025-11-10

### Added
- **GitignoreParser Service**: Parse .gitignore file to automatically exclude files and directories from file watching
  - Respects project-specific .gitignore patterns
  - Always excludes `.git` directory to prevent circular updates
  - Falls back to sensible defaults when .gitignore is not found
  - Reduces file change events for large directories like `node_modules`, `out`, `dist`
- **Git Status Caching**: Implement 5-second cache for git status results
  - Eliminates redundant git status executions within cache window
  - Up to 80% reduction in git status calls during active development
  - Maintains data freshness with reasonable cache duration
- **Git Operation Throttling**: Prevent concurrent git status executions
  - Returns cached results when git operation is already in progress
  - Reduces git lock contention and prevents command queue buildup

### Changed
- **File Changes View - Debounce Time**: Extended from 1500ms to 2500ms
  - Groups more file changes into single refresh operation
  - Reduces refresh frequency during continuous development
  - Better handles build and compilation operations
- **File Changes View - Visibility Optimization**: Complete monitoring stop when view is hidden
  - Zero CPU usage when File Changes view is not visible
  - Cancels pending refreshes when view becomes hidden
  - Triggers immediate refresh when view becomes visible
  - Improves battery life on laptops

### Performance
- **CPU Usage**: 70-90% reduction for File Changes view operations
- **Git Commands**: Up to 80% reduction in git status executions
- **Background Activity**: Zero CPU usage when view is hidden
- **Build Operations**: Minimal performance impact during compilations

### Technical
- New file: `src/services/GitignoreParser.ts` for .gitignore parsing
- Modified: `src/services/FileWatcherService.ts` to filter excluded files
- Modified: `src/extension.ts` GitChangesProvider with caching and throttling

## [0.4.8] - 2025-11-10

### Changed
- **Start Task Command**: Renamed "Create Task" to "Start Task" and changed icon to rocket (🚀)
  - Creates a new directory under the default path and automatically generates a timestamped Markdown file
  - The created file is automatically selected in Markdown List with "editing" label
  - The file opens in Markdown Editor View for immediate editing
  - Provides a streamlined workflow for starting new tasks
- **Add Directory Behavior**: Changed to create directories under the currently selected directory instead of the root path
  - Right-click menu "New Directory" now creates subdirectories in the selected location
  - Allows for better organization and nested directory structures

## [0.4.6] - 2025-11-09

### Added
- **Markdown List - Configurable Sort Order**: Added settings to customize how markdown files are sorted
  - New setting `aiCodingSidebar.markdownList.sortBy`: Choose sort criteria (name, created, modified)
  - New setting `aiCodingSidebar.markdownList.sortOrder`: Choose sort direction (ascending, descending)
  - Settings changes are reflected in real-time without requiring refresh
- **Markdown List - Sort Order Display**: Current sort order is now displayed in the view title
  - Shows sort criteria and direction (e.g., "Markdown List (Created ↑)")
  - Updates automatically when settings change
  - Makes it clear how files are currently sorted

### Changed
- **Markdown List - Default Sort Order**: Changed default file sort order from name (ascending) to creation date (ascending)
  - Files are now sorted by creation date in ascending order by default
  - Timestamp-named files (e.g., `2025_1109_1230.md`) naturally appear in chronological order
  - Previous behavior (sort by name) can be restored by changing `aiCodingSidebar.markdownList.sortBy` to "name"

## [0.4.5] - 2025-11-09

### Fixed
- **Markdown Editor State Persistence**: Fixed issue where Markdown Editor loses file state when extension becomes inactive/active
  - Previously, when the extension sidebar became inactive and then active again, the Markdown Editor would show empty content
  - Added `retainContextWhenHidden: true` to markdownEditor view configuration to preserve webview context when hidden
  - Added `onDidChangeVisibility` listener to restore file content when view becomes visible
  - Added webview ready message handling to ensure file restoration after webview initialization
  - Now, the previously selected file is automatically restored when the extension becomes active
  - Maintains seamless editing experience across extension lifecycle changes

## [0.4.4] - 2025-11-09

### Changed
- **View Titles Simplification**: Simplified all view titles for cleaner UI
  - Directory List: Removed relative path from title, now shows only "Directory List"
  - Markdown List: Removed relative path from title, now shows only "Markdown List"
  - Provides consistent and simpler interface across all views
- **Markdown List - Directory Header**: Added directory name display at the top of file list
  - Shows the current directory path relative to Directory List root
  - Similar to Markdown Editor's filename display for consistency
  - Makes it clear which directory you're browsing without cluttering the title
- **Markdown List - Editing File Indicator**: Added "editing" indicator for files being edited in Markdown Editor
  - Files currently being edited in Markdown Editor View now show "editing" in their description
  - Automatically updates when switching files without manual refresh
  - Makes it easier to identify which file is actively being edited in the sidebar
- **Markdown Editor - Title Display**: Simplified title to show only the filename
  - Previously showed the full relative path from project root
  - Now displays only the filename for cleaner UI
- **Markdown Editor - Auto-clear on Folder Switch**: Editor now clears when switching folders in Markdown List
  - Prevents confusion by not showing files from previous folders
  - Automatically resets editor state when navigating to different directories
- **Directory List - Add Directory Behavior**: "Add Directory" command now always creates directories in the Directory List root
  - Previously created directories under the selected directory when invoked from context menu
  - Now consistently creates directories in the Directory List's root directory regardless of how the command is invoked
  - Provides more predictable behavior for directory creation

## [0.4.3] - 2025-11-09

### Changed
- **Directory List Auto-Selection**: Newly created directories are now automatically selected in Directory List view
  - When creating a directory via "Add Directory" command, the new directory is immediately selected
  - Provides better visual feedback and easier navigation after directory creation
- **Markdown File Icon**: Markdown files in Markdown List view now display different icons based on how they open
  - Timestamp-named files (format: `YYYY_MMDD_HHMM.md`) that open in Markdown Editor View display edit icon (✏️)
  - Other markdown files that open in standard editor display markdown icon
  - Makes it clearer which files can be edited directly in the sidebar versus standard editor

## [0.4.2] - 2025-11-08

### Changed
- **Markdown List View Behavior**: Markdown files now open conditionally based on filename format
  - Timestamp-named files (format: `YYYY_MMDD_HHMM.md`) open in Markdown Editor View
  - Other Markdown files open in the standard VSCode editor
  - Provides more flexible file editing options based on file naming conventions

## [0.4.1] - 2025-11-08

### Changed
- **Markdown File Creation**: Created Markdown files now open in Markdown Editor View instead of text editor
  - Applies to both "Create Markdown File" command and "Add Directory" command
  - Provides a more integrated experience when creating files from Markdown List
  - When creating a new directory, the auto-created markdown file also opens in Markdown Editor View
  - Automatically displays the file content in the sidebar's Markdown Editor View

## [0.4.0] - 2025-11-08

### Added
- **Rename Directory**: Added "Rename Directory" context menu item to Directory List view
  - Right-click on any directory in Directory List to rename it
  - Validates directory names and prevents invalid characters
  - Updates both Directory List and Markdown List views after renaming

### Changed
- **Terminology Update**: Updated all "Folder" references to "Directory" for consistency
  - Command names: `addFolder` → `addDirectory`, `deleteFolder` → `deleteDirectory`
  - Menu labels: "Add Folder" → "Add Directory", "Delete Folder" → "Delete Directory"
  - Function names and internal references updated throughout the codebase

## [0.3.7] - 2025-11-08

### Added
- **Markdown Editor View**: Added a new sidebar view for editing Markdown files directly in the extension
  - Automatically displays when selecting a Markdown file in Markdown List
  - Edit Markdown content in a dedicated textarea editor
  - Save files with `Cmd+S` / `Ctrl+S` keyboard shortcut
  - Shows the file path in the header for context
  - Positioned below Markdown List for easy access
  - Provides a seamless workflow for editing AI coding instructions without leaving the sidebar
  - **Read-only Mode**: Automatically switches to read-only mode when the file is active in VSCode editor
    - Prevents conflicts between simultaneous edits in editor and sidebar
    - Displays "Read-only" indicator when the file is active in VSCode editor
    - Dynamically toggles between editable and read-only based on active editor state
    - Shows unsaved changes indicator (●) when content is modified
    - Displays relative path from project root for context
  - **Context Menu Integration**: Added context menu items for enhanced workflow
    - "Open in Editor" menu item in Markdown List view to open files in VSCode editor
    - "Copy Relative Path" menu item in both Markdown List and Markdown Editor views

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

[0.6.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.5.9...v0.6.0
[0.5.9]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.5.8...v0.5.9
[0.5.8]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.5.7...v0.5.8
[0.5.7]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.5.6...v0.5.7
[0.5.6]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.4.9...v0.5.0
[0.4.9]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.4.8...v0.4.9
[0.4.8]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.4.6...v0.4.8
[0.4.6]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/NaokiIshimura/vscode-ai-coding-sidebar/compare/v0.3.7...v0.4.0
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
