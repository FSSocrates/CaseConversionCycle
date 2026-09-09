import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class CaseConversionCyclePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        page.set_title('Case Conversion Cycle');
        page.set_icon_name('format-text-bold-symbolic');
        window.add(page);

        const behaviorGroup = new Adw.PreferencesGroup();
        behaviorGroup.set_title('Behavior');
        behaviorGroup.set_description('Cycle selected text: miXEd CasE → UPPER CASE → lower case → Title Case → UPPER CASE …');
        page.add(behaviorGroup);

        const hotkeyRow = new Adw.ActionRow();
        hotkeyRow.set_title('Hotkey');
        hotkeyRow.set_subtitle('Choose the global shortcut used by the extension.');

        const hotkeyButton = new Gtk.Button();
        hotkeyButton.set_valign(Gtk.Align.CENTER);
        hotkeyButton.add_css_class('suggested-action');
        hotkeyButton.set_tooltip_text('Click and press the desired shortcut. Press Escape to clear it.');
        hotkeyRow.add_suffix(hotkeyButton);
        behaviorGroup.add(hotkeyRow);

        // Gtk.accelerator_parse() is a native out-parameter API and its GJS return
        // shape differs between versions, so use the stored string for fallback display.
        const setDisplayedHotkey = () => {
            const accelerator = settings.get_strv('toggle-hotkey')[0] ?? '';
            if (!accelerator) {
                hotkeyButton.set_label('Disabled');
                return;
            }

            try {
                const [, keyval, mods] = Gtk.accelerator_parse(accelerator);
                hotkeyButton.set_label(Gtk.accelerator_get_label(keyval, mods));
            } catch (_) {
                hotkeyButton.set_label(accelerator);
            }
        };

        setDisplayedHotkey();

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_controller, keyval, _keycode, state) => {
            if (keyval === Gdk.KEY_Escape) {
                hotkeyButton.set_label('Disabled');
                settings.set_strv('toggle-hotkey', ['']);
                hotkeyButton.remove_controller(controller);
                return Gdk.EVENT_STOP;
            }

            const modifiers = state & Gtk.accelerator_get_default_mod_mask();
            if (!Gtk.accelerator_valid(keyval, modifiers))
                return Gdk.EVENT_STOP;

            const accelerator = Gtk.accelerator_name(keyval, modifiers);
            settings.set_strv('toggle-hotkey', [accelerator]);
            hotkeyButton.grab_focus();
            setDisplayedHotkey();
            hotkeyButton.remove_controller(controller);
            return Gdk.EVENT_STOP;
        });

        hotkeyButton.connect('clicked', () => {
            hotkeyButton.set_label('Press shortcut…');
            hotkeyButton.add_controller(controller);
            hotkeyButton.grab_focus();
        });

        settings.connect('changed::toggle-hotkey', setDisplayedHotkey);

        const offsetGroup = new Adw.PreferencesGroup();
        offsetGroup.set_title('Selection Offset Apps');
        offsetGroup.set_description(
            'Enter one application ID, package name, or process name per line. These apps use a two-character offset when the selected text ends with a line break.'
        );
        page.add(offsetGroup);

        const offsetBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
        });

        const scrolled = new Gtk.ScrolledWindow();
        scrolled.set_min_content_height(220);
        scrolled.set_vexpand(true);

        const offsetText = new Gtk.TextView();
        offsetText.set_wrap_mode(Gtk.WrapMode.NONE);
        offsetText.set_monospace(true);
        offsetText.set_top_margin(10);
        offsetText.set_bottom_margin(10);
        offsetText.set_left_margin(10);
        offsetText.set_right_margin(10);
        scrolled.set_child(offsetText);
        offsetBox.append(scrolled);

        const clearButton = new Gtk.Button({ label: 'Clear list' });
        clearButton.set_halign(Gtk.Align.END);
        offsetBox.append(clearButton);

        offsetGroup.add(offsetBox);

        const offsetBuffer = offsetText.get_buffer();
        offsetBuffer.set_text(settings.get_string('selection-offset-apps'), -1);

        let updatingBuffer = false;
        offsetBuffer.connect('changed', () => {
            if (updatingBuffer)
                return;

            const [start, end] = offsetBuffer.get_bounds();
            const raw = offsetBuffer.get_text(start, end, false);
            settings.set_string('selection-offset-apps', normalizeLines(raw));
        });

        settings.connect('changed::selection-offset-apps', () => {
            const value = settings.get_string('selection-offset-apps');
            const [start, end] = offsetBuffer.get_bounds();
            if (offsetBuffer.get_text(start, end, false) === value)
                return;

            updatingBuffer = true;
            offsetBuffer.set_text(value, -1);
            updatingBuffer = false;
        });

        clearButton.connect('clicked', () => offsetBuffer.set_text('', -1));
    }
}

function normalizeLines(text) {
    return text
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n');
}
