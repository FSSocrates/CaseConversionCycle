import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

function delay(ms) {
    return new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
}

function toggleCase(str) {
    // 1. UPPERCASE -> lowercase
    if (str === str.toUpperCase() && str !== str.toLowerCase()) {
        return str.toLowerCase();
    }
    // 2. lowercase -> Title Case
    if (str === str.toLowerCase() && str !== str.toUpperCase()) {
        return str.replace(/[a-zA-Z0-9]+/g, word => word.charAt(0).toUpperCase() + word.slice(1));
    }
    // 3. Otherwise (Title Case or mixed) -> UPPERCASE
    return str.toUpperCase();
}

export default class CaseConversionCycle extends Extension {
    enable() {
        // Exposed on the extension instance for D-Bus invocation
    }

    disable() {
    }

    async processSelectionToggle() {
        const clipboard = St.Clipboard.get_default();
        const seat = Clutter.get_default_backend().get_default_seat();
        const virtualKeyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);

        const sendKey = (keysym, modifiers = []) => {
            const time = Clutter.get_current_event_time();
            for (const mod of modifiers) {
                virtualKeyboard.notify_keyval(time, mod, Clutter.KeyState.PRESSED);
            }
            virtualKeyboard.notify_keyval(time, keysym, Clutter.KeyState.PRESSED);
            virtualKeyboard.notify_keyval(time, keysym, Clutter.KeyState.RELEASED);
            for (const mod of modifiers) {
                virtualKeyboard.notify_keyval(time, mod, Clutter.KeyState.RELEASED);
            }
        };

        // 1. Backup original clipboard
        let originalClipboard = '';
        await new Promise(resolve => {
            clipboard.get_text(St.ClipboardType.CLIPBOARD, (_, text) => {
                originalClipboard = text || '';
                resolve();
            });
        });

        // 2. Cut selection (Ctrl + X)
        sendKey(Clutter.KEY_x, [Clutter.KEY_Control_L]);
        await delay(100);

        // 3. Read cut text
        let cutText = '';
        await new Promise(resolve => {
            clipboard.get_text(St.ClipboardType.CLIPBOARD, (_, text) => {
                cutText = text || '';
                resolve();
            });
        });

        if (!cutText) {
            // Restore original clipboard if no selection existed
            clipboard.set_text(St.ClipboardType.CLIPBOARD, originalClipboard);
            return;
        }

        // 4. Transform text case
        const modifiedText = toggleCase(cutText);
        clipboard.set_text(St.ClipboardType.CLIPBOARD, modifiedText);
        await delay(50);

        // 5. Paste transformed text (Ctrl + V)
        sendKey(Clutter.KEY_v, [Clutter.KEY_Control_L]);
        await delay(100);

        // 6. Reselect pasted text (Shift + Left Arrow x length)
        for (let i = 0; i < modifiedText.length; i++) {
            sendKey(Clutter.KEY_Left, [Clutter.KEY_Shift_L]);
        }

        // 7. Restore original clipboard
        clipboard.set_text(St.ClipboardType.CLIPBOARD, originalClipboard);
    }
}
