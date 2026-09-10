# ChatGPT Arabic Reels Editor Skill

سكيل مخصص لـChatGPT يساعد على تحويل فيديوهات الخبراء وصنّاع المحتوى إلى ريلز عربية عمودية قابلة للتعديل، مع دعم RTL وخط Cairo.

## ماذا تتضمن؟

- تخطيط القص وحذف السكتات والتكرار.
- توليد كابشن عربي متزامن وقابل للتعديل.
- زوم وانتقالات هادئة تخدم المعنى.
- كتابة خلف المتحدث وبطاقات توضيحية.
- أوضاع عرض `FULL` و`STAGE` و`SIDE` للموازنة بين حضور المتحدث والشرح.
- تمرير كلمات مختارة خلف الشخص عند توفر قناع مناسب، مع بديل آمن لبقية الأنظمة.
- ملف `brief.json` لتحديد هدف الريل والعرض والدعوة قبل تصميم المشاهد.
- فحص المنطقة الآمنة لمنصات الفيديو العمودي.
- معالجة الصوت، بما فيها خفض الخلفية تلقائيًا أثناء الكلام، وتصدير H.264/AAC وملف SRT.
- محرر Chrome محلي في `scripts/studio.html`.

## المتطلبات

- Python 3
- FFmpeg
- Node.js وnpm
- Chrome أو Chromium
- `openai-whisper` و`numpy`

افحص البيئة أولًا:

```bash
bash scripts/00_setup.sh
```

بعد موافقة المستخدم على تنزيل الاعتماديات الناقصة:

```bash
bash scripts/00_setup.sh --install
```

## بدء مشروع جديد

```bash
bash scripts/12_init_work.sh ./work/my-reel /path/to/source-video.mp4
```

ثم اتبع خط الإنتاج الكامل في [SKILL.md](SKILL.md).

للمشاريع التي تتطلب شرحًا مرئيًا كثيفًا، يمكن تفعيل أدلة المنطقة الآمنة في `safe.json` عبر `guides: true` أثناء المعاينة، ثم إعادتها إلى `false` قبل التصدير النهائي.

## تخصيص الهوية

عدّل `assets/default-theme.json` أو ملف `theme.json` داخل مجلد المشروع. القيم الافتراضية عامة ولا تحتوي على اسم علامة أو حساب حقيقي.

## الأمان والخصوصية

- لا تحتوي الحزمة على مفاتيح API أو رموز وصول أو معرّفات حسابات.
- لا تحفظ الأسرار داخل ملفات المشروع أو الواجهة.
- ضع أي إعدادات خاصة بخدمات النشر في متغيرات بيئة محلية غير مرفوعة.
- ملفات الفيديو ومجلدات الإخراج مستبعدة من Git افتراضيًا؛ راجع `.gitignore` قبل العمل بمواد حساسة.

## ملاحظة الترخيص

المستودع متاح للعرض حاليًا، ولم يُضف له ترخيص إعادة استخدام بعد.

---

An Arabic-first, RTL-aware reels editing skill for ChatGPT with a local rendering pipeline. It includes cut planning, timed captions, safe-zone checks, audio mastering, motion overlays, SRT export, and a local Chrome editor. No credentials, account identifiers, or publishing integrations are included.
