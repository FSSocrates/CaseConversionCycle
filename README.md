# Case Conversion Cycle

A lightweight GNOME Shell extension that cycles highlighted text between **lowercase**, **Title Case**, and **UPPERCASE** using a customizable system hotkey.

## Installation

### Manual Installation

Clone the repository and copy the source directory into your local GNOME extensions path:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions
git clone [https://github.com/FSSocrates/CaseConversionCycle.git](https://github.com/FSSocrates/CaseConversionCycle.git)
cp -r CaseConversionCycle/src ~/.local/share/gnome-shell/extensions/ccc@fssocrates.github.io
```

Restart GNOME Shell (log out and log back in on Wayland) and enable the extension:

```bash
gnome-extensions enable ccc@fssocrates.github.io
```

## Setting Up Keyboard Shortcut

1. Open **Settings** → **Keyboard** → **View and Customize Shortcuts** → **Custom Shortcuts**.
2. Click **+** to add a new shortcut.
3. Configure the fields:
   - **Name:** `Case Conversion Cycle`
   - **Command:**
     ```bash
     gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "imports.ui.main.extensionManager.lookup('ccc@fssocrates.github.io').processSelectionToggle()"
     ```
   - **Shortcut:** Press your preferred hotkey combination (e.g., `Super` + `Shift` + `C`).
