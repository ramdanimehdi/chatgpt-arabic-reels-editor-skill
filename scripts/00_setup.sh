#!/bin/bash
# فحص وتجهيز الأدوات.  ./00_setup.sh          → يفحص ويقول وش ناقص
#                      ./00_setup.sh --install → ينزّل الناقص (بعد إذن المستخدم)
INSTALL=0; [ "$1" = "--install" ] && INSTALL=1
MISS=(); OK=(); NOTE=()
have(){ command -v "$1" >/dev/null 2>&1; }
line(){ printf '%s\n' "$1"; }
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
find_chrome(){
  [ -n "$CHROME_PATH" ] && [ -x "$CHROME_PATH" ] && { printf '%s' "$CHROME_PATH"; return; }
  for c in google-chrome google-chrome-stable chromium chromium-browser chrome; do
    have "$c" && { command -v "$c"; return; }
  done
  for p in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"; do
    [ -x "$p" ] && { printf '%s' "$p"; return; }
  done
}

have ffmpeg && OK+=("ffmpeg") || MISS+=("ffmpeg")
python3 -c "import whisper" 2>/dev/null && OK+=("whisper") || MISS+=("whisper")
python3 -c "import numpy"  2>/dev/null && OK+=("numpy")   || MISS+=("numpy")
CHROME="$(find_chrome)"
[ -x "$CHROME" ] && OK+=("chrome") || MISS+=("chrome")
node -e "require.resolve('puppeteer-core',{paths:[process.argv[1]]})" "$SCRIPT_DIR" 2>/dev/null && OK+=("puppeteer-core") || MISS+=("puppeteer-core")

line "الجاهز: ${OK[*]:-لا شيء}"
# شاشة Remotion اختيارية ولا تؤثر في المحرك الأساسي
if [ -d "$SCRIPT_DIR/remotion-template/src" ] && have npm; then
  line "شاشة التعديل الاختيارية: متاحة عند الطلب"
else
  line "شاشة التعديل الاختيارية: غير مضمّنة — المحرك الأساسي كامل"
fi
if [ ${#MISS[@]} -eq 0 ]; then line "✅ كل شي جاهز — نقدر نبدأ."; exit 0; fi
line "الناقص: ${MISS[*]}"

if [ $INSTALL -eq 0 ]; then line "شغّل: $0 --install"; exit 10; fi

for m in "${MISS[@]}"; do
  case "$m" in
    ffmpeg)
      if have brew; then line "⏬ ffmpeg…"; brew install ffmpeg || NOTE+=("ffmpeg فشل")
      else NOTE+=("لازم Homebrew أول: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""); fi ;;
    whisper) line "⏬ openai-whisper… (الموديل ينزل أول تشغيل، 1.4 قيقا)"
      pip3 install --quiet openai-whisper || pip3 install --quiet --break-system-packages openai-whisper || NOTE+=("whisper فشل") ;;
    numpy)   pip3 install --quiet numpy || pip3 install --quiet --break-system-packages numpy || NOTE+=("numpy فشل") ;;
    puppeteer-core) line "⏬ أداة رسم الفريمات…"; npm install --silent --prefix "$SCRIPT_DIR" || NOTE+=("أداة رسم الفريمات فشلت") ;;
    chrome) NOTE+=("Chrome/Chromium غير موجود — ثبّته أو حدّد CHROME_PATH") ;;
  esac
done

FAIL=0
have ffmpeg || FAIL=1
python3 -c "import whisper,numpy" 2>/dev/null || FAIL=1
[ -x "$CHROME" ] || FAIL=1
node -e "require.resolve('puppeteer-core',{paths:[process.argv[1]]})" "$SCRIPT_DIR" 2>/dev/null || FAIL=1
[ ${#NOTE[@]} -gt 0 ] && printf '⚠️  %s\n' "${NOTE[@]}"
[ $FAIL -eq 0 ] && line "✅ كل شي جاهز الحين." || { line "❌ باقي ناقص — شوف الملاحظات فوق."; exit 11; }
