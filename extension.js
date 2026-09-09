import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const COPY_TIMEOUT_MS = 1000;
const COPY_POLL_MS = 25;
const PASTE_DELAY_MS = 100;
const RESELECT_DELAY_MS = 50;

function sleep(ms) {
    return new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
}

function runCommand(argv) {
    return new Promise((resolve, reject) => {
        let proc;
        try {
            proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
        } catch (e) {
            reject(e);
            return;
        }

        proc.wait_async(null, (_proc, result) => {
            try {
                proc.wait_finish(result);
                resolve(proc.get_successful());
            } catch (e) {
                reject(e);
            }
        });
    });
}

async function sendKeyChord(key) {
    // ydotool uses Linux input-event key codes. These are stable evdev codes:
    // Left Ctrl=29, C=46, V=47.
    const keyCode = key === 'c' ? 46 : (key === 'x' ? 45 : 47);
    return runCommand([
        'ydotool', 'key',
        `29:1`,
        `${keyCode}:1`,
        `${keyCode}:0`,
        `29:0`,
    ]);
}

async function sendLeft() {
    // KEY_LEFT = evdev 105.
    return runCommand(['ydotool', 'key', '105:1', '105:0']);
}

async function sendShiftLeft(count) {
    if (count <= 0)
        return true;

    // Left Shift=42, Left Arrow=105.
    const events = ['42:1'];
    for (let i = 0; i < count; i++) {
        events.push('105:1', '105:0');
    }
    events.push('42:0');

    return runCommand(['ydotool', 'key', ...events]);
}

function clipboardText() {
    return new Promise(resolve => {
        const clipboard = St.Clipboard.get_default();
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (_clipboard, text) => {
            resolve(text ?? '');
        });
    });
}

function setClipboardText(text) {
    St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
}

async function waitForClipboardChange(sentinel) {
    const deadline = GLib.get_monotonic_time() + COPY_TIMEOUT_MS * 1000;

    while (GLib.get_monotonic_time() < deadline) {
        const text = await clipboardText();
        if (text !== sentinel)
            return text;
        await sleep(COPY_POLL_MS);
    }

    return null;
}

function titleCase(text) {
    // Mirrors the intended AHK behavior as closely as practical for Unicode text.
    return text.replace(/\p{L}[\p{L}\p{N}]*/gu, word =>
        word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()
    );
}

function classifyCase(text) {
    const upper = text.toLocaleUpperCase();
    const lower = text.toLocaleLowerCase();

    const isUpper = text === upper && text !== lower;
    const isLower = text === lower && text !== upper;

    if (isUpper)
        return lower;
    if (isLower)
        return titleCase(text);
    return upper;
}

function trailingLineBreak(text) {
    return /[\r\n]+$/.test(text);
}

function getSelectionOffsetApps(text) {
    return new Set(
        text
            .split(/\r?\n/)
            .map(line => line.trim().toLocaleLowerCase())
            .filter(Boolean)
    );
}

function currentApplicationIds() {
    const window = global.display.get_focus_window();
    if (!window)
        return [];

    const ids = new Set();

    try {
        const appId = window.get_gtk_application_id?.();
        if (appId)
            ids.add(appId.toLocaleLowerCase());
    } catch (_) {
        // Some window types do not expose an application ID.
    }

    try {
        const wmClass = window.get_wm_class?.();
        if (wmClass)
            ids.add(wmClass.toLocaleLowerCase());
    } catch (_) {
        // Ignore unsupported window metadata.
    }

    try {
        const wmClassInstance = window.get_wm_class_instance?.();
        if (wmClassInstance)
            ids.add(wmClassInstance.toLocaleLowerCase());
    } catch (_) {
        // Ignore unsupported window metadata.
    }

    try {
        const pid = window.get_pid?.();
        if (pid > 0) {
            const procPath = `/proc/${pid}/exe`;
            const [ok, bytes] = GLib.file_get_contents(procPath);
            if (ok) {
                const target = new TextDecoder().decode(bytes);
                const slash = target.lastIndexOf('/');
                const basename = slash >= 0 ? target.slice(slash + 1) : target;
                if (basename)
                    ids.add(basename.toLocaleLowerCase());
            }
        }
    } catch (_) {
        // /proc may be unavailable or inaccessible.
    }

    return [...ids];
}

function needsSelectionOffset(offsetApps) {
    const currentIds = currentApplicationIds();
    return currentIds.some(id => offsetApps.has(id));
}

export default class CaseConversionCycleExtension extends Extension {
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
        const savedClipboard = await clipboardText();
        const sentinel = `__CCC_SENTINEL__${GLib.get_monotonic_time()}`;

        try {
            // Match the AutoHotkey behavior: clear the clipboard, cut the selection,
            // transform it, then paste the replacement back into the same location.
            setClipboardText(sentinel);

            if (!(await sendKeyChord('x')))
                return;

            const text = await waitForClipboardChange(sentinel);
            if (text === null || text.length === 0)
                return;

            const transformed = classifyCase(text);
            const hasBreak = trailingLineBreak(text);
            const offsetApps = getSelectionOffsetApps(
                this._settings.get_string('selection-offset-apps')
            );

            setClipboardText(transformed);
            await sleep(PASTE_DELAY_MS);

            if (!(await sendKeyChord('v')))
                return;

            await sleep(RESELECT_DELAY_MS);

            if (hasBreak)
                await sendLeft();

            // Match the AHK rule: ordinary apps compensate one character for a
            // trailing line break; configured offset apps compensate two.
            const offset = hasBreak ? (needsSelectionOffset(offsetApps) ? 2 : 1) : 0;
            const length = Math.max(0, text.length - offset);

            await sendShiftLeft(length);
        } catch (e) {
            console.error(`${this.metadata.name}: conversion failed`, e);
        } finally {
            // This extension can only preserve text clipboard contents, unlike
            // AHK ClipboardAll(), which can preserve arbitrary clipboard formats.
            setClipboardText(savedClipboard);
            this._busy = false;
        }
    }
}
