#!/usr/bin/env bash
#
# package-desktop.sh — turn the web build into Windows and Linux executables
# for Steam, WITHOUT porting the game.
#
# The game is not touched and not rewritten. `desktop/game/` is a byte-for-byte
# copy of what package.sh already produces for itch.io, and `desktop/main.js`
# is a ~200 line Electron shell that serves those files over a real origin,
# opens one window, and lets the Steam overlay in. Same bytes on itch and on
# Steam: one game, two wrappers.
#
# THE ORDER MATTERS, and it is the whole point:
#
#   1. ./package.sh builds dist/ and PROVES IT LOADS in a browser — one 404
#      and it stops. The desktop build is downstream of that, so it can never
#      ship files the web build would have failed on.
#   2. the shell is packaged for both platforms.
#   3. the PACKAGED Linux build is then run — the actual executable, not the
#      source tree — and it plays itself: past the label, through the menu,
#      into the city, and screenshots what it sees. Every file the game asks
#      for and does not get is counted, and one is enough to fail this script.
#
# Usage:  ./package-desktop.sh
# Output: desktop/out/THE PARTY-linux-x64/   and  ...-win32-x64/
#
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
app="$here/desktop"
out="$app/out"
shot="${PARTY_SHOT:-$app/selftest.png}"

# ---------------------------------------------------------------------------
echo "==> 1/4  the web build, and its own proof"
"$here/package.sh" | sed 's/^/    /'

echo "==> 2/4  copying the build into the shell"
[ -d "$app/node_modules/electron" ] || ( cd "$app" && npm install --no-audit --no-fund )
rm -rf "$app/game"
cp -r "$here/dist" "$app/game"
# The shell has no business shipping anything the web build does not have, so
# this is a copy and never a hand-picked list — the same rule, and the same
# reason, as the wholesale assets/ copy in package.sh.
echo "    $(find "$app/game" -type f | wc -l | tr -d ' ') files, $(du -sh "$app/game" | cut -f1)"

# ---------------------------------------------------------------------------
# --asar=false on purpose. An asar is one big archive, so a one-line fix to
# one source file re-uploads the whole 10 MB of game as a changed file in the
# Steam depot. Loose files let Steam's delta patching do its job, and they
# also mean a player can look at what they bought.
echo "==> 3/4  packaging windows + linux"
( cd "$app" && ./node_modules/.bin/electron-packager . "THE PARTY" \
    --platform=linux,win32 --arch=x64 \
    --out=out --overwrite --no-asar --prune=true \
    --executable-name=the-party \
    --ignore="^/out($|/)" --ignore="^/selftest.*\.png$" \
    --ignore="^/\.git($|/)" --ignore="^/node_modules($|/)" 2>&1 | sed 's/^/    /' )
# node_modules is ignored outright rather than pruned: the shell has no runtime
# dependencies at all - electron and the packager are both dev dependencies -
# and prune leaves a tree of empty folders behind.

# A launcher next to the Linux binary, carrying the one switch on the command
# line, where Chromium parses it before a line of our JavaScript has run. The
# shell sets that switch itself and this should be redundant - but if a machine
# ever dies on /dev/shm before main.js gets a vote, this is the thing to run,
# and it is also the right Steam launch option on Linux if that ever happens.
cat > "$out/THE PARTY-linux-x64/play-the-party.sh" <<'LAUNCH'
#!/bin/sh
cd "$(dirname "$0")" || exit 1
exec ./the-party --disable-dev-shm-usage "$@"
LAUNCH
chmod +x "$out/THE PARTY-linux-x64/play-the-party.sh"

# ---------------------------------------------------------------------------
echo "==> 4/4  running the packaged linux build and grading it"
lin="$out/THE PARTY-linux-x64/the-party"
[ -x "$lin" ] || { echo "ERROR: no linux executable at $lin"; exit 1; }
if ! "$lin" --selftest="$shot" 2>/dev/null; then
  echo "ERROR: the packaged build failed its own selftest. This is not a release."
  echo "       Re-run it yourself to see why:"
  echo "       \"$lin\" --selftest --dev"
  exit 1
fi

echo ""
echo "==> what came out"
for d in "$out"/*/; do
  printf '    %-28s %s\n' "$(basename "$d")" "$(du -sh "$d" | cut -f1)"
done
echo ""
echo "Play it:        cd desktop && npm start          (windowed)"
echo "                cd desktop && npm run fullscreen"
echo "Screenshot:     $shot"
echo ""
echo "Steam, when the app ID exists:"
echo "  depot = the whole folder above, uploaded with steamcmd / the SDK's"
echo "  ContentBuilder. Launch option exe: the-party.exe (windows),"
echo "  the-party (linux). No installer: Steam IS the installer."
