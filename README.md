# AI Coding Sidebar

A sidebar extension that strengthens integration with AI coding tools.
Browse and manage files and folders efficiently to keep coding with AI smooth.

## Features

| Feature | Description |
| --- | --- |
| **Directory List** | Display directories under a specified path.<br>Configure a default path in settings.<br>Create new directories. |
| **Markdown List** | Display Markdown files and create new ones. |
| **File Changes** | List modified files and review diffs. |
| **Settings** | Open user or global settings.<br>Customize templates. |

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd+Shift+A` (macOS)<br>`Ctrl+Shift+A` (Windows/Linux) | Focus AI Coding Sidebar |

### Basic actions
1. Click the "AI Coding Sidebar" icon in the activity bar (or press `Cmd+Shift+A` / `Ctrl+Shift+A`).
2. Use Directory List to create the folder you use for AI coding.
3. Create Markdown files from Markdown List.
4. Write instructions for the AI in the Markdown file.
5. Right-click the Markdown file in Markdown List and choose "Copy Relative Path," then share it with your AI tool.

## Template Feature

When you create a file from Markdown List, you can automatically populate it with a template. This keeps Markdown files used for AI coding consistent and saves time.

### Configure the template
1. Click the gear icon (⚙️) in the Directory List pane.
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
| Create Branch | Right-click a directory to create a git branch with that directory's name. |

## Other Features

### Create Files and Folders

| Item | Steps |
| --- | --- |
| Create a folder | Click the folder icon in Directory List.<br>Enter a folder name to create it. |
| Create a file | Click the "+" icon in Markdown List.<br>A timestamped Markdown file is created (for example, `2025_1103_1227.md`). |

### Configure the Default Relative Path

| Method | Steps |
| --- | --- |
| Directory List settings (recommended) | 1. Click the gear icon (⚙️) in Directory List.<br>2. The settings view opens with `aiCodingSidebar.defaultRelativePath` pre-filtered.<br>3. Edit the default relative path (for example, `src`, `.claude`, `docs/api`). |
| Workspace settings | 1. Click the gear icon (⚙️) in Directory List.<br>2. Select "Workspace Settings."<br>3. Choose one of the following:<br>&nbsp;&nbsp;- **Create/Edit settings.json**: Generate or edit the workspace settings file.<br>&nbsp;&nbsp;- **Configure .claude folder**: Create a `.claude` folder and apply settings.<br>&nbsp;&nbsp;- **Customize template**: Edit the template used when creating files. |
| Inline from the extension | 1. Click the edit icon (✏️) in Directory List.<br>2. Enter a relative path (for example, `src`, `.claude`, `docs/api`).<br>3. Choose whether to save it to settings. |

#### Relative path examples
- `src` → `<project>/src`
- `docs/api` → `<project>/docs/api`
- `.claude` → `<project>/.claude`
- empty string → workspace root

#### When the configured path doesn't exist
If the default relative path doesn't exist, Directory List displays a "Create directory" button. Click it to automatically create the directory and display its contents.

### Other

| Feature | Description |
| --- | --- |
| Copy relative path | Copy the workspace-relative path to the clipboard. |
| Directory List settings | Open the settings view from Directory List to edit the default relative path directly. |
| Search | Search files across the workspace. |

## Settings

| Setting | Description | Type | Default | Options / Examples |
| --- | --- | --- | --- | --- |
| `defaultRelativePath` | Default relative path for Directory List | string | `""` (workspace root) | `"src"`, `.claude`, `"docs/api"` |
| `sortBy` | File sort key | string | `"name"` | `"name"` (name)<br>`"type"` (type)<br>`"size"` (size)<br>`"modified"` (modified time) |
| `sortOrder` | Sort order | string | `"ascending"` | `"ascending"` (ascending)<br>`"descending"` (descending) |
| `showHidden` | Show hidden files and folders | boolean | `false` | - |
| `showFileIcons` | Show file icons | boolean | `true` | - |
| `autoRefresh` | Refresh automatically on filesystem changes | boolean | `true` | - |
| `viewMode` | Display mode | string | `"tree"` | `"tree"` (tree view)<br>`"list"` (list view) |

### Example configuration

Add the following to `.vscode/settings.json`:

```json
{
  "aiCodingSidebar.defaultRelativePath": ".claude",
  "aiCodingSidebar.sortBy": "modified",
  "aiCodingSidebar.sortOrder": "descending",
  "aiCodingSidebar.showHidden": false,
  "aiCodingSidebar.showFileIcons": true,
  "aiCodingSidebar.autoRefresh": true,
  "aiCodingSidebar.viewMode": "tree"
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
