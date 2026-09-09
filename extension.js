import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const COPY_TIMEOUT_MS = 1000;
const COPY_POLL_MS = 25;
const PASTE_DELAY_MS = 100;
const RESELECT_DELAY_MS = 50;

const EVDEV = {
    CTRL: 29,
    C: 46,
    X: 45,
    V: 47,
    LEFT: 105,
    SHIFT: 42,
};

function sleep(milliseconds) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

function runCommand(argv) {
    return new Promise((resolve, reject) => {
        try {
            const process = new Gio.Subprocess({
                argv,
                flags: Gio.SubprocessFlags.NONE,
            });

            process.init();

            process.wait_async(null, (proc, result) => {
                try {
                    proc.wait_finish(result);
                    resolve(proc.get_exit_status());
                } catch (error) {
                    reject(error);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function sendKey(key, modifiers = []) {
    const events = [];

    // Press modifiers first, then the key
    for (const mod of modifiers)
        events.push(`${mod}:1`);
    events.push(`${key}:1`);

    // Release key first, then modifiers (reverse order)
    events.push(`${key}:0`);
    for (const mod of [...modifiers].reverse())
        events.push(`${mod}:0`);

    await runCommand(['ydotool', 'key', ...events]);
}

function getClipboard() {
    return new Promise(resolve => {
        St.Clipboard.get_default().get_text(
            St.ClipboardType.CLIPBOARD,
            (_clipboard, text) => resolve(text ?? '')
        );
    });
}

function setClipboard(text) {
    St.Clipboard.get_default().set_text(
        St.ClipboardType.CLIPBOARD,
        text
    );
}

async function waitForClipboardChange(originalText) {
    const start = GLib.get_monotonic_time();

    while (
        (GLib.get_monotonic_time() - start) / 1000 <
        COPY_TIMEOUT_MS
    ) {
        const text = await getClipboard();

        if (text !== originalText)
            return text;

        await sleep(COPY_POLL_MS);
    }

    return null;
}

function titleCase(text) {
    return text.replace(
        /\p{L}[\p{L}\p{N}]*/gu,
        word =>
            word.charAt(0).toLocaleUpperCase() +
            word.slice(1).toLocaleLowerCase()
    );
}

function classifyCase(text) {
    const upper = text.toLocaleUpperCase();
    const lower = text.toLocaleLowerCase();

    if (text === upper && text !== lower)
        return 'upper';

    if (text === lower && text !== upper)
        return 'lower';

    return 'mixed';
}

function convertCase(text) {
    switch (classifyCase(text)) {
    case 'upper':
        return text.toLocaleLowerCase();

    case 'lower':
        return titleCase(text);

    default:
        return text.toLocaleUpperCase();
    }
}

function hasTrailingLineBreak(text) {
    return /[\r\n]+$/.test(text);
}

function getConfiguredOffsetApps(settings) {
    return new Set(
        settings
            .get_string('selection-offset-apps')
            .split(/\r?\n/)
            .map(line => line.trim().toLowerCase())
            .filter(Boolean)
    );
}

function getCurrentApplicationIds() {
    const window = global.display.get_focus_window();

    if (!window)
        return [];

    const ids = new Set();

    try {
        const id = window.get_gtk_application_id();

        if (id)
            ids.add(id.toLowerCase());
    } catch (_) {
    }

    try {
        const wmClass = window.get_wm_class();

        if (wmClass)
            ids.add(wmClass.toLowerCase());
    } catch (_) {
    }

    try {
        const instance = window.get_wm_class_instance();

        if (instance)
            ids.add(instance.toLowerCase());
    } catch (_) {
    }

    try {
        const pid = window.get_pid();

        if (pid > 0) {
            const file = Gio.File.new_for_path(`/proc/${pid}/exe`);
            const info = file.query_info(
                'standard::symlink-target',
                Gio.FileQueryInfoFlags.NONE,
                null
            );
            const target = info.get_symlink_target();

            if (target) {
                const name = GLib.path_get_basename(target);
                if (name)
                    ids.add(name.toLowerCase());
            }
        }
    } catch (_) {
    }

    return [...ids];
}

function needsSelectionOffset(settings) {
    const configured = getConfiguredOffsetApps(settings);

    if (configured.size === 0)
        return false;

    return getCurrentApplicationIds()
        .some(id => configured.has(id));
}

export default class CaseConversionCycle extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._busy = false;

        Main.wm.addKeybinding(
            'toggle-hotkey',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            () => this._convertSelection()
        );
    }

    disable() {
        Main.wm.removeKeybinding('toggle-hotkey');

        this._settings = null;
        this._busy = false;
    }

    async _convertSelection() {
        if (this._busy)
            return;

        this._busy = true;

        const originalClipboard = await getClipboard();

        try {
            setClipboard('');

            // Cut the current selection, matching the requested behavior.
            await sendKey(EVDEV.X, [EVDEV.CTRL]);

            const selectedText =
                await waitForClipboardChange('');

            if (selectedText === null || selectedText.length === 0)
                return;

            const transformedText =
                convertCase(selectedText);

            setClipboard(transformedText);

            await sleep(PASTE_DELAY_MS);

            await sendKey(EVDEV.V, [EVDEV.CTRL]);

            const trailingLineBreak =
                hasTrailingLineBreak(selectedText);

            if (trailingLineBreak)
                await sendKey(EVDEV.LEFT);

            let selectionLength =
                transformedText.length;

            if (trailingLineBreak) {
                selectionLength -=
                    needsSelectionOffset(this._settings)
                        ? 2
                        : 1;
            }

            if (selectionLength > 0) {
                await sleep(RESELECT_DELAY_MS);

                for (let i = 0; i < selectionLength; i++) {
                    await sendKey(
                        EVDEV.LEFT,
                        [EVDEV.SHIFT]
                    );
                }
            }
        } catch (error) {
            console.error(
                `[Case Conversion Cycle] ${error.message}`
            );
        } finally {
            setClipboard(originalClipboard);
            this._busy = false;
        }
    }
}
