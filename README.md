# Case Conversion Cycle

**Case Conversion Cycle** is a GNOME Shell extension that reproduces the case-cycling behavior of the original AutoHotkey implementation:

`miXEd CasE → UPPER CASE → lower case → Title Case → UPPER CASE → …`

A mixed-case selection goes directly to `UPPERCASE`.

## Features

- User-configurable global hotkey, with **F1 enabled by default**.
- Selection is cut and replaced, matching the original AutoHotkey behavior.
- Trailing line breaks are detected.
- A configurable list of applications can receive the special two-character selection offset.
- The offset-app list is a multiline text box: **one application ID / package name / process name per line**.

## Requirements

- GNOME Shell 46.
- `ydotool` available in `PATH` and configured to inject keyboard input.
- GNOME Shell's clipboard support.

The extension deliberately does not bundle `ydotool`.

## Installation

```bash
git clone https://github.com/FSSocrates/CaseConversionCycle.git
cd CaseConversionCycle
gnome-extensions install --force .
gnome-extensions enable ccc@fssocrates.github.io
```

Open its preferences from Extensions / Extension Manager and assign a hotkey.

You can also install directly from a packaged ZIP:

```bash
gnome-extensions pack .
gnome-extensions install --force ccc@fssocrates.github.io.shell-extension.zip
```

## Selection Offset Apps

Enter one identifier per line, for example:

```text
org.gnome.TextEditor
org.gnome.gedit
code
```

The extension checks several identifiers exposed by the focused window, including GTK application ID, WM class, WM class instance, and the process executable name where available. This makes the list useful across native Wayland apps and XWayland applications.

## Clipboard note

The original AutoHotkey implementation uses `ClipboardAll()` and therefore restores arbitrary clipboard formats. GNOME Shell's `St.Clipboard` path used here is intentionally text-focused, so this implementation preserves and restores the clipboard's text rather than every possible MIME format.

## GNOME Extensions review note

The extension reads clipboard data and therefore declares clipboard access in its description. It also does not ship a default clipboard-interacting keyboard shortcut; the user must configure the shortcut explicitly.

## License

GPL-3.0-or-later.
