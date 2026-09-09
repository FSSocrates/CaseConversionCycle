# Case Conversion Cycle

A GNOME Shell extension for cycling selected text through several common capitalization styles with a configurable global keyboard shortcut.

## Case Cycle

The extension cycles selected text through these states:

`miXEd CasE → UPPER CASE → lower case → Title Case → UPPER CASE → …`

The cycle is determined from the current selection:

| Current selection | Next result  |
| ----------------- | ------------ |
| Mixed case        | `UPPER CASE` |
| UPPER CASE        | `lower case` |
| lower case        | `Title Case` |
| Title Case        | `UPPER CASE` |

Text that does not contain alphabetic case distinctions follows the uppercase path.

## Features

* **Global keyboard shortcut**

  * Configurable from the extension preferences.
  * **F1** is enabled by default.
* **Automatic case detection**

  * Determines the appropriate next state from the selected text.
* **Selection preservation**

  * The converted text remains selected after conversion.
* **Trailing-line-break handling**

  * Selections ending with a line break receive special cursor/selection handling.
* **Selection Offset Apps**

  * Applications with different selection behavior can be added to an exception list.
  * Each application identifier or process name is entered on its own line.
* **Persistent settings**

  * Shortcut and application exceptions are stored through GNOME's settings system.

## Requirements

* GNOME Shell 46
* `ydotool`
* A working `ydotoold` configuration capable of injecting keyboard input

The extension does not bundle `ydotool`.

## Installation

Clone the repository:

```bash
git clone https://github.com/FSSocrates/CaseConversionCycle.git
cd CaseConversionCycle
```

Install the extension:

```bash
gnome-extensions install --force .
```

Enable it:

```bash
gnome-extensions enable ccc@fssocrates.github.io
```

Open the extension's preferences through **Extensions** or **Extension Manager**.

## Configuration

### Hotkey

The default hotkey is:

```text
F1
```

To change it, open the extension preferences and activate the **Hotkey** control, then press the desired keyboard shortcut.

The shortcut can also be cleared.

### Selection Offset Apps

Some applications require a different selection length adjustment when the selected text ends with a line break.

Add those applications under **Selection Offset Apps**, with **one identifier per line**.

Example:

```text
org.gnome.TextEditor
org.gnome.gedit
code
```

The extension compares the entries against application information available for the focused window, including application ID, window-manager class, window-manager class instance, and executable name where available.

Blank lines are ignored.

## How It Works

When the configured shortcut is activated:

1. The currently selected text is obtained.
2. Its case state is determined.
3. The next case state is generated.
4. The converted text replaces the original selection.
5. The converted text is selected again.

A selection ending with one or more line breaks receives additional handling so that the resulting selection remains correctly positioned.

## Clipboard

The extension uses GNOME Shell's clipboard facilities while processing text.

Only the **text clipboard content** is preserved and restored. Non-text clipboard formats are not guaranteed to survive a conversion.

## Project Structure

```text
CaseConversionCycle/
├── extension.js
├── metadata.json
├── prefs.js
└── schemas/
    └── org.gnome.shell.extensions.ccc.gschema.xml
```

## Extension ID

```text
ccc@fssocrates.github.io
```

## License

GPL-3.0-or-later
