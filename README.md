# AI Coding Sidebar

A sidebar extension that strengthens integration with AI coding tools.
Browse and manage files and folders efficiently to keep coding with AI smooth.

## Features

| Feature | Description |
| --- | --- |
| **Tasks** | Display directories under a specified path.<br>Configure a default path in settings.<br>Create new directories. |
| **Docs** | Display all files and create new ones.<br>Files are sorted by creation date (ascending) by default.<br>The current sort order is shown in the view title (e.g., "Docs (Created ↑)").<br>Customize sort order in settings. |
| **Editor** | Edit Markdown files directly in the sidebar.<br>Auto-displays when selecting a timestamp-named Markdown file (format: `YYYY_MMDD_HHMM.md`).<br>Other Markdown files open in the standard editor.<br>Save with `Cmd+S` / `Ctrl+S`.<br>Run task with `Cmd+R` / `Ctrl+R` to send `claude "read <file>"` to terminal (auto-saves before running).<br>Automatically switches to read-only mode when the file is active in VSCode editor. |
| **File Changes** | List modified files and review diffs.<br>Performance optimized with .gitignore-based exclusion, git status caching, and smart refresh strategies.<br>70-90% CPU usage reduction with zero background activity when hidden. |
| **Menu** | Open user or global settings.<br>Customize templates.<br>Quick shortcuts: Open terminal, Checkout default branch, Git pull. |

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd+Shift+A` (macOS)<br>`Ctrl+Shift+A` (Windows/Linux) | Focus AI Coding Sidebar |
| `Cmd+R` (macOS)<br>`Ctrl+R` (Windows/Linux) | Run task in Editor (auto-saves and sends command to terminal) |

### Basic actions
1. Click the "AI Coding Sidebar" icon in the activity bar (or press `Cmd+Shift+A` / `Ctrl+Shift+A`).
2. Use Tasks to create the folder you use for AI coding.
3. Create Markdown files from Docs.
4. Click a timestamp-named Markdown file (e.g., `2025_1103_1227.md`) in Docs to edit it in the Editor view below. Other Markdown files open in the standard editor.
5. Write instructions for the AI in the Editor and save with `Cmd+S` / `Ctrl+S`.
6. Right-click the Markdown file in Docs and choose "Copy Relative Path," then share it with your AI tool.

## Template Feature

When you create a file from Docs, you can automatically populate it with a template. This keeps Markdown files used for AI coding consistent and saves time.

### Configure the template
1. Click the gear icon (⚙️) in the Tasks pane.
2. Choose "Workspace Settings" → "Customize template."
3. `.vscode/templates/file.md` is created.
4. Edit the template and save it.

### Default template
The first template contains the following:

```markdown
created: {{datetime}}
file: {{filename}}

---

## overview


## tasks

```

### Available variables
Use the following variables inside a template:

- `{{datetime}}`: Creation date and time (for example, 2025/11/3 12:27:13)
- `{{filename}}`: Filename including extension (for example, 2025_1103_1227.md)
- `{{timestamp}}`: Timestamp (for example, 2025_1103_1227)

### Template priority
1. Workspace template `.vscode/templates/file.md` (if present)
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
| Drag & Drop | Move files or folders by dragging them. |
| Checkout Branch | Right-click a directory to checkout a git branch using the directory name. Creates the branch if it doesn't exist, or switches to it if it already exists. |

## Other Features

### Create Files and Folders

| Item | Steps |
| --- | --- |
| Start Task | Click the rocket icon (🚀) in Tasks title menu.<br>Creates a new directory under the default path and automatically generates a timestamped Markdown file.<br>The file is selected in Docs with "editing" label and opens in Editor View. |
| New Directory | Click the folder icon in Tasks.<br>Creates a new directory under the currently selected directory. |
| Create a file | Click the "+" icon in Docs.<br>A timestamped Markdown file is created (for example, `2025_1103_1227.md`) and opens in Editor View. |

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
| `defaultRelativePath` | Default relative path for Tasks | string | `""` (workspace root) | `"src"`, `.claude`, `"docs/api"` |
| `markdownList.sortBy` | Sort files in Docs by | string | `"created"` | `"name"` (file name)<br>`"created"` (creation date)<br>`"modified"` (modified date) |
| `markdownList.sortOrder` | Sort order for files in Docs | string | `"ascending"` | `"ascending"` (ascending)<br>`"descending"` (descending) |

### Example configuration

Add the following to `.vscode/settings.json`:

```json
{
  "aiCodingSidebar.defaultRelativePath": ".claude",
  "aiCodingSidebar.markdownList.sortBy": "created",
  "aiCodingSidebar.markdownList.sortOrder": "ascending"
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
