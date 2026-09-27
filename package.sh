#!/usr/bin/env bash
#
# package.sh — assemble a self-contained itch.io build of THE PARTY.
#
# This game has it easier than BATIDÃO DE CÔCO's packager: there is no shared
# asset repo next door, so there are no base paths to rewrite and nothing to
# resolve. Everything already sits under assets/ and every path in the source
# is already relative to the page. So the whole job is: copy what ships, leave
# out what does not, and PROVE the result loads.
#
# TWO THINGS SHIP WRONG IF NOBODY CHECKS, and they fail in opposite ways:
#
#   - Something is missing. Invisible: dev keeps working because it reads the
#     repo, and only the zip is broken. The flying dungeon shipped every build
#     without its fly sprites this way. So assets/ is copied WHOLESALE and the
#     exclusions are written down here, one line each, with a reason — the
#     opposite of a hand-written copy list, which fails by omission.
#   - Something junk ships. Visible, in the size — 28 MB of source footage is
#     not subtle — so the build prints what it is carrying, biggest first.
#
# And then it loads the build in a browser and fails on a single 404, which is
# the check neither of the other two games has.
#
# Usage:  ./package.sh
# Output: dist/  and  the-party-itch.zip
#
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
dist="$here/dist"
zipname="the-party-itch.zip"
port=8791

# ---------------------------------------------------------------------------
# WHAT DOES NOT SHIP, and why.  Each of these is checked against the source
# below: the moment one of them is actually used by the game, this build fails
# rather than quietly shipping a game that 404s.
# ---------------------------------------------------------------------------
EXCLUDE=(
  "assets/bats-dancing.mp4"        # 28 MB of source footage; the cuts ship, it does not
  "assets/intro"                   # the intro frames, not used by the game yet
  "assets/dystopian-canticle"      # the typeface that lost; deathly is the one in use
  "assets/bats-ending.mp4.json"    # how that clip was cut; preview/scrub.html reads it, the game does not
)

echo "==> checking nothing excluded is actually needed"
for ex in "${EXCLUDE[@]}"; do
  # On a PATH BOUNDARY, or `assets/intro` flags `assets/intro-screen/` and the
  # build refuses to run over a folder it is not excluding at all.
  pat="$(printf '%s' "$ex" | sed 's/[.]/\\./g')([^A-Za-z0-9_.-]|$)"
  if grep -rqE "$pat" "$here/src" "$here/index.html" "$here/css" 2>/dev/null; then
    echo "ERROR: $ex is in the EXCLUDE list but the game asks for it."
    grep -rnE "$pat" "$here/src" "$here/index.html" "$here/css" | head -3
    echo "       Either stop excluding it, or stop using it."
    exit 1
  fi
done

echo "==> cleaning"
rm -rf "$dist" "$here/$zipname"
mkdir -p "$dist"

echo "==> code"
cp "$here/index.html" "$dist/"
cp -r "$here/css" "$here/src" "$dist/"

echo "==> assets"
excl=()
for ex in "${EXCLUDE[@]}"; do excl+=(--exclude="./${ex#assets/}" --exclude="./${ex#assets/}/*"); done
( cd "$here/assets" && tar cf - "${excl[@]}" . ) | ( mkdir -p "$dist/assets" && cd "$dist/assets" && tar xf - )

# The label builds its filenames rather than writing them out, so a scan of the
# source cannot enumerate assets/intro-screen/ - which is exactly why the copy
# above is wholesale.  What the scan IS good for is the other direction: every
# path the source names as a literal had better be in the build.
echo "==> checking every asset the source names is in the build"
bad=0
while read -r ref; do
  f="$(printf '%b' "${ref//%/\\x}")"          # party-shadow%20beasts-01.png
  [ -f "$dist/$f" ] || { echo "   MISSING IN BUILD: $f"; bad=1; }
done < <(grep -rhoE "assets/[A-Za-z0-9_%.-]+(/[A-Za-z0-9_%.-]+)*\.[a-z0-9]{2,4}" \
           "$here/src" "$here/index.html" "$here/css" | sort -u)
[ "$bad" -eq 0 ] || { echo "ERROR: build is incomplete"; exit 1; }

# itch's one hard requirement.
[ -f "$dist/index.html" ] || { echo "ERROR: no index.html at the top of dist/"; exit 1; }

# ---------------------------------------------------------------------------
# AND THEN IT IS ACTUALLY LOADED.  A build that is missing something says
# nothing at all until somebody opens it - the game just draws placeholders, or
# opens on black.  So the build is served and opened, and the server's own log
# is read back: one 404 and this is not a release.
# ---------------------------------------------------------------------------
echo "==> loading the build and watching for 404s"
log="$(mktemp)"
python3 -m http.server "$port" --directory "$dist" >"$log" 2>&1 &
server=$!
trap 'kill $server 2>/dev/null || true' EXIT
sleep 1

# ?label=0 skips the studio label's three seconds - its pictures are still
# fetched, because everything is loaded before the front door either way, and
# the ending's clip is asked for the moment the label is done.
if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --autoplay-policy=no-user-gesture-required --window-size=1280,720 \
    --virtual-time-budget=15000 --dump-dom "http://localhost:$port/?label=0" >/dev/null 2>&1 || true
  kill $server 2>/dev/null || true
  wait $server 2>/dev/null || true

  # /favicon.ico is the browser asking on its own behalf, not the game asking
  # for one of its own files.  Nothing else is forgiven.
  if grep -E '" (4|5)[0-9][0-9] ' "$log" | grep -qv 'favicon.ico'; then
    echo "ERROR: the build asked for things it does not contain:"
    grep -E '" (4|5)[0-9][0-9] ' "$log" | grep -v 'favicon.ico' | sed 's/^/   /'
    exit 1
  fi
  echo "    $(grep -cE '" 200 ' "$log" || true) files served, no 404s"

  # what was carried but never asked for, for the report further down
  python3 - "$dist" "$log" > "$log.served" <<'PY'
import sys, pathlib, re, urllib.parse
dist, log = pathlib.Path(sys.argv[1]), open(sys.argv[2]).read()
got = {urllib.parse.unquote(p.split('?')[0])
       for p in re.findall(r'"GET (/[^ ]*) HTTP', log)}
for f in sorted(dist.rglob('*')):
    if f.is_file():
        rel = '/' + str(f.relative_to(dist))
        if rel not in got and rel != '/index.html':
            print(f'{rel}  ({f.stat().st_size // 1024} kB)')
PY
else
  kill $server 2>/dev/null || true
  echo "    SKIPPED: google-chrome not found, so nobody has opened this build"
fi

# Anything carried into the build that the game never asked for.  Not an error
# - the music is only fetched on the first keypress and the font's licence is
# not fetched at all - but it is where junk shows up, so it is printed.
if [ -s "$log.served" ]; then
  echo "==> shipped, but nothing asked for it in a passive load"
  while IFS= read -r f; do
    case "$f" in */ost/*|*eula*) note="  (expected)";; *) note="";; esac
    echo "    ${f}${note}"
  done < "$log.served"
fi
rm -f "$log" "$log.served"

echo "==> what is in it"
du -ah "$dist" | grep -vE '/$' | sort -rh | head -8 | sed 's/^/    /'

if command -v zip >/dev/null 2>&1; then
  ( cd "$dist" && zip -qr "../$zipname" . )
  size="$(du -h "$here/$zipname" | cut -f1)"
  files="$(find "$dist" -type f | wc -l | tr -d ' ')"
  echo
  echo "Built: $dist"
  echo "Zip:   $here/$zipname   ($size, $files files)"
  echo
  echo "Upload the ZIP to itch.io and set the project kind to HTML."
  echo "Embed: 1280x720, fullscreen ON, mobile OFF, autostart OFF."
  echo
  echo "One thing before you charge for it: Deathly is 1001Fonts FREE FOR"
  echo "PERSONAL USE. A free page is fine. Money needs a licence from the"
  echo "foundry, or a different face. Its EULA ships in assets/deathly/."
else
  echo "Built: $dist  (no zip installed - zip the CONTENTS of dist/ yourself)"
fi
