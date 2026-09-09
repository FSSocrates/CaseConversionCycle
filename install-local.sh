#!/usr/bin/env bash
set -euo pipefail

UUID='ccc@fssocrates.github.io'
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

rm -rf "$DEST"
mkdir -p "$DEST"
cp -a metadata.json extension.js prefs.js README.md LICENSE schemas "$DEST/"

glib-compile-schemas "$DEST/schemas"
gnome-extensions enable "$UUID" || true

echo "Installed $UUID to $DEST"
echo "Open Extension Manager or GNOME Extensions to configure the hotkey."
