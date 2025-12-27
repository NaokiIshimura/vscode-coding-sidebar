# AI Coding Sidebar

A sidebar extension that strengthens integration with AI coding tools.
Browse and manage files and folders efficiently to keep coding with AI smooth.

## Features

| Feature | Description |
| --- | --- |
| **Tasks** | Display directories and files under a specified path in a unified hierarchical view.<br>Configure a default path in settings.<br>Create new directories and files.<br>**Hierarchical display**: Directories contain both subdirectories and files in a tree structure.<br>Files are sorted by creation date (ascending) by default within each directory.<br>**Drag & Drop**: Copy files by dragging them within the view or from external sources.<br>**Auto-refresh**: Automatically updates when files are created, modified, or deleted.<br>**Settings icon**: Quick access to default path and sort configuration. |
| **Editor** | Edit Markdown files directly in the sidebar.<br>Auto-displays when selecting a timestamp-named Markdown file (format: `YYYY_MMDD_HHMM_TASK.md`).<br>Other Markdown files open in the standard editor.<br>Save with `Cmd+S` / `Ctrl+S` (creates new file if none is open - saves to current Tasks directory).<br>Run task with `Cmd+R` / `Ctrl+R` to send a customizable command to terminal (auto-saves before running, works even without a file open).<br>Create new markdown file with `Cmd+M` / `Ctrl+M`.<br>**Customizable run command**: Configure the command executed by the Run button in settings.<br>**Run without file**: Execute commands using editor content when no file is open.<br>**Terminal View integration**: Run commands can be sent to the embedded Terminal view (configurable).<br>Automatically switches to read-only mode when the file is active in VSCode editor.<br>Auto-saves when switching to another extension or file.<br>Restores the editing file when returning from another extension.<br>**Settings icon**: Quick access to run command configuration. |
| **Terminal** | Embedded terminal in the sidebar using xterm.js.<br>Supports shell commands with full PTY support.<br>**Configurable**: Customize shell path, font size, font family, cursor style, cursor blink, and scrollback lines.<br>**Controls**: New terminal, Clear, and Kill buttons in the title bar.<br>**Default visibility**: Collapsed (expand when needed). |
| **Menu** | Open user or global settings.<br>Customize templates.<br>Quick shortcuts: Open terminal, Checkout default branch, Git pull, Duplicate workspace in new window.<br>**Beta Features**: Open Task Panel to view files & Editor in the editor area. |

### Task Panel (Beta)

When enabled via `aiCodingSidebar.taskPanel.enabled`, the Task Panel provides an integrated view of files and Editor in the editor area.

| Feature | Description |
| --- | --- |
| **Active Panels View** | Lists all open Task Panels in the sidebar for easy navigation:<br>- Click to focus a panel<br>- Right-click to close a panel (with unsave confirmation)<br>- Shows unsaved indicator (●) for panels with pending changes<br>- Automatically updates when directory changes |
| **Tab Icon** | Different icons distinguish how the panel was opened:<br>- **Tree icon**: Opened by selecting a directory in Tasks view<br>- **Folder icon**: Opened via "Open Task Panel" command |
| **Terminal Reuse** | The Run button reuses existing terminals with the same name instead of creating new ones each time.<br>Terminals are opened with the project root as the current working directory. |
| **Non-Task File Position** | Configure where non-task files open when clicked:<br>- **below**: Opens in an editor group below the Task Panel<br>- **beside** (default): Opens in an editor group to the right of the Task Panel<br>- Configure via `aiCodingSidebar.taskPanel.nonTaskFilePosition` setting<br>- Cmd/Ctrl+click always opens files to the right |
| **File Icons** | Files in the Docs section display icons based on their type, similar to the Docs view in the sidebar. |
| **Parent Directory Navigation** | Parent directory link ("..") is always visible when within the Tasks view root directory, allowing easy navigation to parent directories without going above the configured root. |
| **Context Menu** | Right-click on directories in the Docs section to access:<br>- **Open Task Panel**: Open a new Task Panel for the selected directory<br>- **Archive**: Move the directory to the archived folder |

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd+Shift+A` (macOS)<br>`Ctrl+Shift+A` (Windows/Linux) | Focus AI Coding Sidebar |
| `Cmd+S` (macOS)<br>`Ctrl+S` (Windows/Linux) | Start Task (when sidebar is focused) |
| `Cmd+M` (macOS)<br>`Ctrl+M` (Windows/Linux) | Create new Markdown file (when sidebar is focused) |
| `Cmd+R` (macOS)<br>`Ctrl+R` (Windows/Linux) | Run task in Editor (auto-saves and sends command to terminal) |

### Basic actions
1. Click the "AI Coding Sidebar" icon in the activity bar (or press `Cmd+Shift+A` / `Ctrl+Shift+A`).
2. Use Tasks to create the folder you use for AI coding.
3. Create Markdown files from the Tasks view.
4. Click a timestamp-named Markdown file (e.g., `2025_1103_1227_TASK.md`) in Tasks to edit it in the Editor view below. Other Markdown files open in the standard editor.
5. Write instructions for the AI in the Editor and save with `Cmd+S` / `Ctrl+S`.
6. Right-click the Markdown file in Tasks and choose "Copy Relative Path," then share it with your AI tool.

## Template Feature

When you create a file from Tasks, you can automatically populate it with a template. This keeps Markdown files used for AI coding consistent and saves time.

### Configure the template
1. Click the gear icon (⚙️) in the Tasks pane.
2. Choose "Workspace Settings" → "Customize template."
3. `.vscode/ai-coding-sidebar/templates/task.md` is created.
4. Edit the template and save it.

### Default template
The first template contains the following:

```markdown
file: {{filename}}
created: {{datetime}}

---

# task

```

### Available variables
Use the following variables inside a template:

- `{{datetime}}`: Creation date and time (for example, 2025/11/3 12:27:13)
- `{{filename}}`: Filename including extension (for example, 2025_1103_1227_TASK.md)
- `{{timestamp}}`: Timestamp (for example, 2025_1103_1227)

### Template priority
1. Workspace template `.vscode/ai-coding-sidebar/templates/task.md` (if present)
2. Built-in extension template

### Template examples
- Capture prompts for AI assistants in the `overview` section.
- Track to-dos in the `tasks` section.
- Add project-specific sections.

## File Operations

| Feature | Description |
| --- | --- |
| Create files or folders | Quickly scaffold new files and folders. |
| Rename | Rename files and folders. |
| Delete | Delete files and folders (moved to trash). |
| Copy / Cut / Paste | Perform standard clipboard operations. |
| Drag & Drop | Copy files by dragging them within the Tasks view or from external sources. Displays a success message after copying. |
| Archive | Archive task directories to keep your workspace organized. Right-click a directory in Tasks view and select "Archive" to move it to the `archived` folder. If a directory with the same name already exists, a timestamp is automatically added to avoid conflicts. |
| Checkout Branch | Right-click a directory to checkout a git branch using the directory name. Creates the branch if it doesn't exist, or switches to it if it already exists. |

## Other Features

### Create Files and Folders

| Item | Steps |
| --- | --- |
| Start Task | Click the rocket icon (🚀) in Tasks title menu.<br>Creates a new directory under the default path and automatically generates a timestamped Markdown file.<br>The file is selected in Tasks with "editing" label and opens in Editor View. |
| New Directory | Click the folder icon in Tasks.<br>Creates a new directory under the currently selected directory. |
| Create a file | Click the "+" icon in Tasks.<br>A timestamped Markdown file is created (for example, `2025_1103_1227_TASK.md`) and opens in Editor View. |

### Configure the Default Relative Path

| Method | Steps |
| --- | --- |
| Tasks settings (recommended) | 1. Click the gear icon (⚙️) in Tasks.<br>2. The settings view opens with `aiCodingSidebar.defaultRelativePath` pre-filtered.<br>3. Edit the default relative path (for example, `src`, `.claude`, `docs/api`). |
| Workspace settings | 1. Click the gear icon (⚙️) in Tasks.<br>2. Select "Workspace Settings."<br>3. Choose one of the following:<br>&nbsp;&nbsp;- **Create/Edit settings.json**: Generate or edit the workspace settings file.<br>&nbsp;&nbsp;- **Configure .claude folder**: Create a `.claude` folder and apply settings.<br>&nbsp;&nbsp;- **Customize template**: Edit the template used when creating files. |
| Inline from the extension | 1. Click the edit icon (✏️) in Tasks.<br>2. Enter a relative path (for example, `src`, `.claude`, `docs/api`).<br>3. Choose whether to save it to settings. |

#### Relative path examples
- `src` → `<project>/src`
- `docs/api` → `<project>/docs/api`
- `.claude` → `<project>/.claude`
- empty string → workspace root

#### When the configured path doesn't exist
If the default relative path doesn't exist, Tasks displays a "Create directory" button. Click it to automatically create the directory and display its contents.

### Other

| Feature | Description |
| --- | --- |
| Copy relative path | Copy the workspace-relative path to the clipboard. |
| Tasks settings | Open the settings view from Tasks to edit the default relative path directly. |
| Search | Search files across the workspace. |

## Settings

| Setting | Description | Type | Default | Options / Examples |
| --- | --- | --- | --- | --- |
| `defaultRelativePath` | Default relative path for Tasks | string | `".claude/tasks"` | `"src"`, `.claude`, `"docs/api"` |
| `markdownList.sortBy` | Sort files in Docs by | string | `"created"` | `"name"` (file name)<br>`"created"` (creation date)<br>`"modified"` (modified date) |
| `markdownList.sortOrder` | Sort order for files in Docs | string | `"ascending"` | `"ascending"` (ascending)<br>`"descending"` (descending) |
| `editor.runCommand` | Command template to execute when clicking the Run button in the Editor view | string | `claude "read ${filePath} and save your report to the same directory as ${filePath}"` | Use `${filePath}` as placeholder for the file path |
| `editor.runCommandWithoutFile` | Command template to execute when clicking the Run button without a file open | string | `claude "${editorContent}"` | Use `${editorContent}` as placeholder for the editor content |
| `editor.useTerminalView` | Send Run commands to the embedded Terminal view | boolean | `true` | When enabled, Run button sends commands to the Terminal view instead of VSCode's integrated terminal |
| `terminal.shell` | Shell executable path for Terminal view | string | `""` | Leave empty to use system default shell |
| `terminal.fontSize` | Font size for Terminal view | number | `12` | Any positive number |
| `terminal.fontFamily` | Font family for Terminal view | string | `"monospace"` | Any valid font family |
| `terminal.cursorStyle` | Cursor style for Terminal view | string | `"block"` | `"block"`, `"underline"`, `"bar"` |
| `terminal.cursorBlink` | Enable cursor blinking in Terminal view | boolean | `true` | `true` or `false` |
| `terminal.scrollback` | Number of scrollback lines in Terminal view | number | `1000` | Any positive number |
| `combinedPanel.enabled` | Enable Combined Panel (Beta) | boolean | `false` | When enabled, selecting a directory in Tasks view opens the Combined Panel in the editor area |
| `taskPanel.nonTaskFilePosition` | Position to open non-task files in Task Panel | string | `"beside"` | `"below"` (open below the Task Panel)<br>`"beside"` (open to the right of the Task Panel) |

### Example configuration

Add the following to `.vscode/settings.json`:

```json
{
  "aiCodingSidebar.defaultRelativePath": ".claude",
  "aiCodingSidebar.markdownList.sortBy": "created",
  "aiCodingSidebar.markdownList.sortOrder": "ascending",
  "aiCodingSidebar.editor.runCommand": "claude \"read ${filePath} and save your report to the same directory as ${filePath}\"",
  "aiCodingSidebar.editor.runCommandWithoutFile": "claude \"${editorContent}\"",
  "aiCodingSidebar.editor.useTerminalView": true,
  "aiCodingSidebar.terminal.fontSize": 12,
  "aiCodingSidebar.terminal.cursorStyle": "block",
  "aiCodingSidebar.combinedPanel.enabled": true,
  "aiCodingSidebar.taskPanel.nonTaskFilePosition": "beside"
}
```

## Development & Build

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Recompile automatically during development
npm run watch
```

## Debugging

### Prepare
1. Install dependencies: `npm install`
2. Compile TypeScript: `npm run compile`

### Start debugging

#### From the Command Palette (recommended)
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac) to open the Command Palette.
2. Type and select "Debug: Start Debugging."
3. Press Enter to launch.

#### Other ways to launch
- **F5**: Start debugging immediately.
- **Run and Debug view**: Open the Run and Debug icon in the sidebar, choose "Run Extension," then click the green ▶ button.
- **Menu bar**: Select "Run" → "Start Debugging."

### While debugging
- A new VS Code window (Extension Development Host) opens.
- The activity bar now shows the "AI Coding Sidebar" icon.
- Set breakpoints, inspect variables, and step through code.
- Press `Ctrl+R` / `Cmd+R` to reload the extension.

## Installation

### Method 1: Development mode (for testing)
1. Clone or download this repository.
2. Open it in VS Code.
3. Press `F5` to launch an Extension Development Host window.
4. Test the extension in the new VS Code instance.

### Method 2: Install from a VSIX package

#### Recommended: Use the latest release from GitHub
1. Download the latest VSIX file from the [GitHub Releases page](https://github.com/NaokiIshimura/vscode-panel/releases).
2. Install via command line:
   ```bash
   code --install-extension ai-coding-sidebar-0.0.1.vsix
   ```
3. Restart VS Code.

#### Use a local build
```bash
# Install directly from the releases directory (version 0.0.1)
code --install-extension releases/ai-coding-sidebar-0.0.1.vsix
```

#### Build the package yourself
1. Install the VSCE tool:
   ```bash
   npm install -g @vscode/vsce
   ```
2. Create a VSIX package:
   ```bash
   npm run package
   ```
3. Install the generated VSIX file:
   ```bash
   code --install-extension releases/ai-coding-sidebar-0.0.1.vsix
   ```
4. Restart VS Code.

## Automated Build & Release

This project uses GitHub Actions to build and release the extension.

### How the automated build works
- **Trigger**: Push to the `master` branch.
- **Build steps**:
  1. Compile TypeScript.
  2. Create the VSIX package automatically.
  3. Upload the package to GitHub Releases.
  4. Update the `releases/` directory in the repository.

### Versioning
Release tags are created based on the `version` field in `package.json`.

```bash
# Bump versions
npm run version:patch   # 0.0.1 → 0.0.2
npm run version:minor   # 0.0.1 → 0.1.0
npm run version:major   # 0.0.1 → 1.0.0
```

## Uninstall

### Via command line
```bash
code --uninstall-extension ai-coding-sidebar
```

### Inside VS Code
1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Search for "AI Coding Sidebar."
3. Click "Uninstall."

## Requirements

- VS Code 1.74.0 or later
- Node.js (development only)
