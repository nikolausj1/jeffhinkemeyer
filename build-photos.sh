#!/usr/bin/env bash
#
# build-photos.sh — optimize photos and regenerate the gallery list.
#
# Reads photos from ../source photos, resizes + recompresses them into
# ./images, and rewrites the images[] array in script.js to match.
# Uses only macOS built-in tools (sips + python3) — no installs needed.
#
# Re-run this any time you add or replace photos in ../source photos:
#     cd site && ./build-photos.sh
#
# A source file whose name contains "preview" or "hero" becomes the hero /
# social-preview image (images/memorial-preview.jpg) and is kept out of the grid.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/../source photos"
OUT="$SCRIPT_DIR/images"
JS="$SCRIPT_DIR/script.js"

MAXDIM=1600   # longest edge, in pixels
QUALITY=80    # JPEG quality (low/normal/high/best or 0-100 via formatOptions)

# Hero / social-preview image. The hero photo ALSO appears in the gallery grid
# (and therefore the slideshow) — it is never excluded.
#   HERO_SOURCE     - the source filename used to build the hero when REGENERATE_HERO
#                     is true (or leave empty and name a source file "preview"/"hero").
#   REGENERATE_HERO - true:  (re)build images/memorial-preview.jpg from HERO_SOURCE.
#                     false: leave images/memorial-preview.jpg untouched, so a hero you
#                            hand-edited/cropped yourself is preserved across rebuilds.
HERO_SOURCE="hero.png"
REGENERATE_HERO=true

# Logo image used in the page (not the gallery). The matching source is rendered
# small to images/memorial-logo.jpg and kept out of the gallery grid.
LOGO_SOURCE="memorial.jpg"
LOGO_MAXDIM=900

if [ ! -d "$SRC" ]; then
    echo "Source folder not found: $SRC" >&2
    exit 1
fi

mkdir -p "$OUT"

# Start clean so removed source photos don't linger in the gallery.
# Never delete the hero here — a hand-edited memorial-preview.jpg must survive.
find "$OUT" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) \
    ! -name 'memorial-preview.jpg' ! -name 'memorial-logo.jpg' -delete

shopt -s nullglob nocaseglob

slugify() {
    # lowercase, strip extension, replace non-alphanumerics with single dashes
    local name="$1"
    name="${name%.*}"
    printf '%s' "$name" \
        | tr '[:upper:]' '[:lower:]' \
        | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

gallery=()
count=0
hero_done=0

for f in "$SRC"/*.jpg "$SRC"/*.jpeg "$SRC"/*.png; do
    [ -e "$f" ] || continue
    base="$(basename "$f")"
    lower="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')"

    # Route the logo source to images/memorial-logo.jpg and keep it out of the gallery.
    # Match case-insensitively (LOGO_SOURCE must be written lowercase).
    if [[ -n "$LOGO_SOURCE" && "$lower" == "$LOGO_SOURCE" ]]; then
        if sips --resampleHeightWidthMax "$LOGO_MAXDIM" \
                -s format jpeg -s formatOptions "$QUALITY" \
                "$f" --out "$OUT/memorial-logo.jpg" >/dev/null 2>&1 \
                && [ -f "$OUT/memorial-logo.jpg" ]; then
            echo "  logo  -> images/memorial-logo.jpg"
        else
            echo "  SKIPPED logo (unreadable): $base" >&2
        fi
        continue
    fi

    # When REGENERATE_HERO=true, (re)build memorial-preview.jpg from the matching
    # source. The photo is NOT skipped — it falls through to the gallery below, so the
    # hero photo also appears in the grid and the slideshow.
    if [ "$REGENERATE_HERO" = "true" ] \
        && { [[ -n "$HERO_SOURCE" && "$lower" == "$HERO_SOURCE" ]] \
             || [[ "$lower" == *preview* || "$lower" == *hero* ]]; }; then
        if sips --resampleHeightWidthMax "$MAXDIM" \
                -s format jpeg -s formatOptions "$QUALITY" \
                "$f" --out "$OUT/memorial-preview.jpg" >/dev/null 2>&1 \
                && [ -f "$OUT/memorial-preview.jpg" ]; then
            hero_done=1
            echo "  hero  -> images/memorial-preview.jpg (also kept in gallery)"
        else
            echo "  SKIPPED hero (unreadable): $base" >&2
        fi
    fi

    slug="$(slugify "$base")"
    ext="jpg"
    case "$lower" in
        *.png) ext="png" ;;
    esac
    out_name="${slug}.${ext}"

    # Avoid collisions from different sources slugging to the same name.
    if [ -e "$OUT/$out_name" ]; then
        out_name="${slug}-$((count)).${ext}"
    fi

    if [ "$ext" = "png" ]; then
        sips --resampleHeightWidthMax "$MAXDIM" \
             "$f" --out "$OUT/$out_name" >/dev/null 2>&1 || true
    else
        sips --resampleHeightWidthMax "$MAXDIM" \
             -s format jpeg -s formatOptions "$QUALITY" \
             "$f" --out "$OUT/$out_name" >/dev/null 2>&1 || true
    fi

    # Only list photos that actually produced an output file.
    if [ -f "$OUT/$out_name" ]; then
        gallery+=("$out_name")
        count=$((count + 1))
    else
        echo "  SKIPPED (unreadable): $base" >&2
    fi
done

echo "Processed $count gallery photo(s)."
if [ "$hero_done" -eq 0 ]; then
    echo "  (no preview/hero source found — images/memorial-preview.jpg unchanged)"
fi

# Regenerate the images[] array in script.js (between 'const images = [' and '];').
python3 - "$JS" "${gallery[@]+"${gallery[@]}"}" <<'PY'
import sys, re, random

js_path = sys.argv[1]
names = sys.argv[2:]

# Shuffle so newly-added photos are mixed throughout the gallery rather than
# clustered at the end. A fixed seed keeps the order stable across reruns of the
# same photo set (it only re-mixes when photos are added or removed).
random.seed(len(names) * 7919 + sum(ord(c) for n in names for c in n))
random.shuffle(names)

with open(js_path, encoding="utf-8") as fh:
    src = fh.read()

body = "".join(f'    "{n}",\n' for n in names)
new_block = "const images = [\n" + body + "];"

pattern = re.compile(r"const images = \[.*?\];", re.S)
if not pattern.search(src):
    sys.exit("Could not find 'const images = [...]' block in script.js")

src = pattern.sub(new_block, src, count=1)

with open(js_path, "w", encoding="utf-8") as fh:
    fh.write(src)

print(f"Wrote {len(names)} entries into {js_path}")
PY

echo "Done."
