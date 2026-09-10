#!/bin/bash
# يهيّئ مجلد عمل جديد بالهوية الافتراضية. الاستخدام:
#   ./12_init_work.sh <workdir> [source-video]
set -e
W="$1"; SRC="${2:-}"
[ -n "$W" ] || { echo "الاستخدام: $0 <workdir> [source-video]"; exit 2; }
SC="$(cd "$(dirname "$0")" && pwd)"; AS="$(cd "$SC/../assets" && pwd)"
mkdir -p "$W"
copy_if_missing(){ [ -f "$W/$2" ] || cp "$1" "$W/$2"; }
copy_if_missing "$AS/default-theme.json" theme.json
copy_if_missing "$AS/default-safe.json" safe.json
copy_if_missing "$AS/default-sfx.json" sfx.json
copy_if_missing "$AS/default-outro.json" outro.json
copy_if_missing "$AS/default-stage.json" stage.json
copy_if_missing "$AS/default-brief.json" brief.json
copy_if_missing "$AS/logo.svg" logo.svg
copy_if_missing "$SC/compose.REFERENCE.html" compose.html
if [ -n "$SRC" ]; then
  [ -f "$SRC" ] || { echo "❌ ملف المصدر غير موجود: $SRC"; exit 3; }
  [ -f "$W/src.mov" ] || cp "$SRC" "$W/src.mov"
fi
echo "✅ مجلد الريل جاهز: $W"
echo "   الهوية: Cairo · RTL · #1A2A4A · #E8610A · @yourhandle"
