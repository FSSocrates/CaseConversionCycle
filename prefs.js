```javascript
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import {
    ExtensionPreferences,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const HOTKEY = 'toggle-hotkey';
const OFFSET_APPS = 'selection-offset-apps';

function normalizeLines(text) {
    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n');
}

function getAcceleratorText(settings) {
    const accelerators = settings.get_strv(HOTKEY);

    return accelerators.length > 0
        ? accelerators[0]
        : 'F1';
}

export default class CaseConversionCyclePreferences
    extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Case Conversion Cycle',
        });

        /*
         * Behavior
         */

        const behaviorGroup = new Adw.PreferencesGroup({
            title: 'Behavior',
            description:
                'miXEd CasE → UPPER CASE → lower case → Title Case → UPPER CASE → …',
        });

        page.add(behaviorGroup);

        /*
         * Global shortcut
         */

        const hotkeyRow = new Adw.ActionRow({
            title: 'Global shortcut',
            subtitle: getAcceleratorText(settings),
        });

        const hotkeyButton = new Gtk.Button({
            label: 'Change',
            valign: Gtk.Align.CENTER,
        });

        hotkeyRow.add_suffix(hotkeyButton);
        behaviorGroup.add(hotkeyRow);

        hotkeyButton.connect('clicked', () => {
            hotkeyButton.set_label('Press shortcut…');

            const controller =
                new Gtk.EventControllerKey();

            controller.connect(
                'key-pressed',
                (_controller, keyval, _keycode, state) => {
                    if (keyval === Gdk.KEY_Escape) {
                        hotkeyButton.set_label('Change');
                        hotkeyButton.remove_controller(controller);
                        return Gdk.EVENT_STOP;
                    }

                    const modifiers =
                        state &
                        (
                            Gdk.ModifierType.SHIFT_MASK |
                            Gdk.ModifierType.CONTROL_MASK |
                            Gdk.ModifierType.ALT_MASK |
                            Gdk.ModifierType.SUPER_MASK
                        );

                    const accelerator =
                        Gtk.accelerator_name(
                            keyval,
                            modifiers
                        );

                    settings.set_strv(
                        HOTKEY,
                        [accelerator]
                    );

                    hotkeyRow.set_subtitle(
                        accelerator
                    );

                    hotkeyButton.set_label('Change');
                    hotkeyButton.remove_controller(controller);

                    return Gdk.EVENT_STOP;
                }
            );

            hotkeyButton.add_controller(controller);
        });

        /*
         * Selection Offset Apps
         */

        const offsetGroup = new Adw.PreferencesGroup({
            title: 'Selection Offset Apps',
            description:
                'Enter one application identifier, window class, or process name per line.',
        });

        page.add(offsetGroup);

        const offsetRow = new Adw.ActionRow({
            title: 'Applications',
        });

        const scrolled = new Gtk.ScrolledWindow({
            min_content_height: 220,
            hexpand: true,
            vexpand: true,
            margin_top: 6,
            margin_bottom: 6,
        });

        const textView = new Gtk.TextView({
            monospace: true,
            wrap_mode: Gtk.WrapMode.NONE,
            top_margin: 8,
            bottom_margin: 8,
            left_margin: 8,
            right_margin: 8,
        });

        scrolled.set_child(textView);
        offsetRow.set_child(scrolled);

        const clearButton = new Gtk.Button({
            label: 'Clear',
            valign: Gtk.Align.CENTER,
        });

        offsetRow.add_suffix(clearButton);
        offsetGroup.add(offsetRow);

        const buffer = textView.get_buffer();

        buffer.set_text(
            settings.get_string(OFFSET_APPS),
            -1
        );

        let updatingBuffer = false;

        buffer.connect('changed', () => {
            if (updatingBuffer)
                return;

            const start = buffer.get_start_iter();
            const end = buffer.get_end_iter();

            const text =
                buffer.get_text(start, end, false);

            const normalized =
                normalizeLines(text);

            if (normalized !== text) {
                updatingBuffer = true;
                buffer.set_text(normalized, -1);
                updatingBuffer = false;
            }

            settings.set_string(
                OFFSET_APPS,
                normalized
            );
        });

        clearButton.connect('clicked', () => {
            buffer.set_text('', -1);
            settings.set_string(OFFSET_APPS, '');
        });

        window.add(page);
    }
}
```
