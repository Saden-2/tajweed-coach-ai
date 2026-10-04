# توثيق المحتوى والمصادر — Tajweed Coach AI

هذا الملف يلبّي البند 05 من قائمة مخرجات التسليم بدليل المشارك: *"توثيق المحتوى
والمصادر الشرعية والمعرفية، وكيفية استخدامها والتحقق منها"* — كبند مستقل عن
العرض التقديمي.

---

## 1. النص القرآني (Uthmani Script)

| الاستخدام | المصدر | الحالة |
|---|---|---|
| عرض المصحف بالواجهة (`app/`) | **Quran Foundation API** — خط QCF V2 الرسمي؛ وللسور التي لا تخدمها البوابة التجريبية (prelive) يُستخدم تلقائيًا **الواجهة العامة `api.quran.com` v4** (نفس البيانات: `code_v2` و`text_uthmani`) — ⚠️ يلزم تأكيد شروط استخدام الواجهة العامة والإسناد قبل التسليم | مدمج فعليًا (`app/api/quran/route.ts`)، لسة فيه مشكلة عرض بعض الـ glyphs لم تُحل بالكامل (موثّقة بـ `DISCLOSURE.md`) |
| بيانات اختبار الباكند المحلية | نص الفاتحة ١:١ (البسملة) مكتوب يدويًا بالتشكيل الكامل داخل `backend/reference_data.py` | مؤقت/تجريبي فقط — الكود نفسه موثّق بأنه TODO: يُستبدل بمصدر Uthmani كامل (QF API أو Tanzil) لكل الـ 6236 آية قبل أي استخدام إنتاجي حقيقي |

**رواية القراءة المعتمدة:** حفص عن عاصم فقط (v1) — قرار موثّق بـ `tajweed-coach-decisions.md` مع المبرر الكامل (توفر بيانات تدريب موسومة فونيميًا لحفص فقط بشكل كافٍ).

## 2. بيانات التدريب والتقييم (Audio + Annotations)

| المصدر | الوصف | الحجم | الترخيص |
|---|---|---|---|
| **muaalem-annotated-v3** (`obadx/mualem-recitations-annotated` على Hugging Face) | تسجيلات تلاوة حقيقية موسومة فونيميًا وبصفات تجويد (sifat) لكل فونيم — هذا الأساس اللي بُني عليه نموذج `quran-muaalem` | 286,586 عبارة (مطابق لرقم 286 ألف المذكور بالعرض التقديمي) | ⚠️ **غير محدد في بطاقة المجموعة على Hugging Face حاليًا (README فاضي)** — يحتاج تأكيد من المؤلف (`obadx`) قبل أي نشر/استخدام علني موسّع. |
| **qdat_bench** | مجموعة اختبار مبنية على **أخطاء متعلمين حقيقيين** (مو قراء محترفين) — نادرة ومهمة لأن أغلب الأبحاث المنشورة تختبر على قراء محترفين فقط | — | ⚠️ نفس ملاحظة الترخيص أعلاه |
| **Ar-DAD** (Arabic Diversified Audio Dataset) | دراسة أكاديمية منشورة: Lataifeh & Elnagar (2020), *Data in Brief*, DOI: [10.17632/3kndp5vs6b.3](https://doi.org/10.17632/3kndp5vs6b.3) — مستضافة على Mendeley Data | — | غير مؤكد من هذه المحادثة — يحتاج فريقنا مراجعة صفحة Mendeley مباشرة وتدوين نص الترخيص بالضبط قبل التسليم |

**استخدامنا الفعلي لهذه البيانات حاليًا:** تقييم أساسي أولي لنموذج `obadx/muaalem-annotated-v3` محليًا (PER = 8.1% على 30 عينة — موثّق بـ `DISCLOSURE.md`)، بالإضافة لأرقام من الأدبيات المنشورة (انظر قسم 5) تُستخدم كنقطة مقارنة مو كنتيجة لمنتجنا.

## 3. النموذج والمكتبات مفتوحة المصدر

| المكوّن | الوصف | الترخيص (مؤكد) |
|---|---|---|
| **quran-muaalem** (checkpoint: `obadx/muaalem-model-v3_2`, ~660M معامل، Wav2Vec2-BERT) | النموذج الأساسي المستخدم لاستخراج الفونيمات وصفات التجويد (sifat) من الصوت | **MIT** (مؤكد من PyPI) |
| **quran_transcript** | مكتبة تحويل النص العثماني لرسم صوتي + تطبيق أحكام تجويد (تستخدمها `model_adapter.py` لحساب الفونيمات المتوقعة ومقارنتها بالمسموع) | **MIT** (مؤكد من بيانات حزمة PyPI، الإصدار 0.6.4) |
| **diff-match-patch** (Google) | محاذاة الفونيمات المتوقعة بالمسموعة (insertions/deletions/substitutions) — نفس الأداة المستخدمة بعرض Gradio الرسمي لـ quran-muaalem | Apache 2.0 (ترخيص Google القياسي للمكتبة) |

⚠️ **ملاحظة فنية موثّقة بالكود (`model_adapter.py`):** اكتُشف (1 أكتوبر 2026) باغ في `quran_transcript` يسبب `IndexError` على أي آية فيها "ال" التعريف، وعولج بإصلاح محلي (`backend/qt_alif_patch.py`) دون تعديل المكتبة. اعتبارًا من 2 أكتوبر 2026 يعمل `get_adapter()` بالنموذج الحقيقي (`MuaalemModelAdapter`) ولا يعود للمحلل التجريبي إلا إذا فشل تحميل النموذج. تفاصيل ومعايرة الأحكام في `tajweed-coach-decisions.md`.

## 4. مصطلحات وأحكام التجويد

المصطلحات العشرة المستخدمة لتصنيف صفات الحروف (الهمس/الجهر، الشدة/الرخاوة، التفخيم/الترقيق، الإطباق/الانفتاح، الصفير، القلقلة، التكرار، التفشي، الاستطالة، الغنة) هي **مصطلحات تجويد كلاسيكية قياسية**، غير مُستحدَثة بهذا المشروع — معرّفة بـ `model_adapter.py` (`SIFAT_AR_NAMES`).

⚠️ **يحتاج الفريق يحدد صراحة** (قبل التسليم النهائي، لإكمال بند "التحقق من المصادر الشرعية"): أي كتاب/مرجع تجويد كلاسيكي معتمد ومعلوم عند عموم أهل التخصص (كـ"تحفة الأطفال" أو متن الجزرية أو غيرها) يُستشهد به رسميًا لتعريف هذه الأحكام بالتوثيق النهائي، حتى يكون الإسناد الشرعي واضحًا للجنة التحكيم — هذا التفصيل ما كان متاحًا لي بهذه المحادثة.

## 5. الأدبيات العلمية المرجعية (لمقارنة الأداء، لا كنتيجة لمنتجنا)

- **AQQD (2025)** — دراسة غطّت 10 قراءات، استُخدمت لتبرير قرار الاقتصار على حفص فقط بالنسخة الأولى (راجع `tajweed-coach-decisions.md`).
- **Interspeech 2025** — دراسة توثّق غياب معيار قياسي موحّد لتقييم النطق القرآني.
- **دراسة منشورة سبتمبر 2025** — توثّق فجوة أداء حادة بين أداء النماذج على قراء خبراء (PER≈0.21%) مقابل متعلمين حقيقيين (PER≈5.8%، Tajweed F1≈75.8%) — هذا بالضبط الفرق اللي مشروعنا يساهم بسدّه (بيانات متعلمين حقيقيين + تحقق بشري، مو خبراء فقط). مذكورة بالعرض التقديمي (شريحة "الفجوة البحثية والمساهمة") لكن بدون رابط/DOI محدد بهذه المحادثة — **يحتاج الفريق إضافة الاستشهاد الكامل (اسم الورقة، المؤلفين، الرابط) بالتوثيق النهائي.**

## 6. التحقق البشري من دقة الأحكام

خطة كاملة موثّقة بملف منفصل: `tajweed-coach-validation-plan.md` بالمشروع. أهم النقاط:

- لجنة من **3 مقيّمين معتمدين تجويديًا على الأقل** لكل مقطع، مستقلين عن فريق التطوير.
- تقييم أعمى (Blind) + قياس التوافق بين المقيّمين (Fleiss' Kappa) لكل نوع حكم.
- تصنيف الأحكام لمستويين بحسب قابليتها للقياس الموضوعي (مدة المدّ، القلقلة... إلخ) مقابل الأحكام الدقيقة سمعيًا اللي حتى البشر يختلفون فيها (تفخيم/ترقيق الراء).
- عتبة قبول: Precision ≥ 90% للمستوى الأول قبل عرضه كـ"خطأ مؤكد" بدون تحفّظ.

⚠️ **حالة التنفيذ الفعلية حتى الآن:** الخطة موثّقة ومعتمدة، لكن **لم تُنفَّذ فعليًا بعد** (لا توجد جلسات تقييم بشري حقيقية منفذة حتى تاريخ هذا الملف) — هذا من أهم الفجوات قبل أي ادّعاء دقة بالعرض النهائي للتحكيم.

## 7. البيانات الحساسة والخصوصية

- لا يحتوي الكود أو الريبو العام على بيانات مستفيدين حقيقيين أو كلمات مرور أو مفاتيح سرية (راجع `.gitignore`).
- أي تسجيلات صوتية حقيقية من مستخدمين (إن وُجدت لاحقًا بمرحلة الاختبار البشري) يجب جمعها بموافقة صريحة، ومعاملتها كبيانات حساسة لا تُنشر بالريبو العام.

---

*آخر تحديث: 1 أكتوبر 2026. يحتاج مراجعة وتحديث مستمر مع تقدّم العمل خلال أيام التحدي (4-6 أكتوبر)، خصوصًا البنود المعلّمة بـ ⚠️ أعلاه.*

## Reference recitation audio (listen-before-you-record)

- Feature: the "Listen to the reciter" button in the practice panel (`app/components/AyahPlayer.tsx`).
- Source: per-ayah MP3 files from EveryAyah.com (`https://everyayah.com/data/<reciter>/<SSSAAA>.mp3`), reciters: Mishary Alafasy (Alafasy_128kbps), Mahmoud Khalil Al-Husary (Husary_128kbps), Mohamed Siddiq Al-Minshawi (Minshawy_Murattal_128kbps).
- Use: streamed directly from the source in the learner's browser; the audio files are NOT copied into this repository or hosted by us. The same Alafasy files were also used (downloaded locally, git-ignored cache) in `backend/validate_accuracy.py` as correct-recitation test samples.
- Checked 4 Oct 2026: EveryAyah audio is described in the Quran community as free for non-commercial use with attribution (CC BY-NC style; see the discussion at github.com/quran/quran_android/issues/434). This prototype is educational and non-commercial, audio is streamed from the source (not copied), and the source is credited in the app footer. ⚠️ No formal licence text was found on everyayah.com itself; if the organisers or the site owner object, the feature can be removed without affecting the rest of the app.

## English meaning (translation) shown under the ayah

- Source: Saheeh International English translation (Quran.com translation resource 20), fetched at request time through the public Quran.com API v4 (`translations=20`) by our `/api/quran` route; shown for Juz Amma (the analysis scope). Stripped of HTML footnote markers; not stored in this repository.
- Checked 4 Oct 2026: the Quran Foundation developer terms (api-docs.quran.foundation/legal/developer-terms) allow building apps on the content provided the text is not altered, the source is credited in a reasonably accessible place (done: app footer, README, this file), and the content is not used to train ML models without consent (we do not train on it; the text is only the reference the recitation is compared with). ⚠️ The terms do not explicitly cover the unauthenticated public `api.quran.com` endpoint we use as a fallback for surahs the pre-live gateway does not serve; production use would need Quran Foundation production credentials. The Saheeh International translation is shown with attribution; its separate licence was not checked.

## Surah list metadata

- Ayah counts and Meccan/Medinan classification (86 Meccan, 28 Medinan; total 6236 ayat) follow the Tanzil / Quran.com convention; entered as static data in `app/components/SurahList.tsx` and checked programmatically (counts sum to 6236).

## Fonts

- Basmala line in the mushaf view uses the open-licence "Amiri Quran" font (SIL OFL) loaded from Google Fonts at runtime; the mushaf page glyphs use the Quran.com/QCF v2 page fonts (`verses.quran.foundation`), as before.

---

## مطابقة «المرجعية والحزمة العلمية والبيانات» الرسمية للتحدي (نسخة 20/3/1448)

| متطلب المرجعية | ما نفعله فعليًا | الحالة |
|---|---|---|
| **القرآن الكريم:** نص بالرسم العثماني من نص معتمد (طبعة مجمع الملك فهد أو ما في quranpedia.net)، مع التأكد من موثوقية نقل الآيات | نعرض الرسم العثماني وخطوط QCF من Quran.com / Quran Foundation، ونقارن التلاوة بالنص نفسه (رواية حفص). لم نعدّل أي حرف من النص | ⚠️ لم نقارن عيّنات من النص بنسخة مجمع الملك فهد (qurancomplex.gov.sa) بعد؛ هذه خطوة تحقق مقترحة، وتبقى مفتوحة |
| **الشفافية:** الإفصاح بأن الحل أداة مدعومة بالذكاء الاصطناعي | تنبيه ظاهر مع كل نتيجة: «تقدير أولي من نموذج ذكاء اصطناعي تجريبي… المرجع النهائي هو المعلّم المجاز» | ✅ |
| **عدم الاستقلال بالفتوى / الإحالة للمختص** | المشروع لا يصدر فتاوى؛ يقارن التلاوة بالنص ويحيل للمعلّم المتخصص | ✅ |
| **الموثوقية والإسناد:** عدم نسبة قول لمرجع غير موجود، والتصريح بعدم الكفاية | نصرّح بأن النتائج أولية وغير معايرة وأنها اختُبرت على عيّنات قليلة (README وDISCLOSURE) | ✅ |
| **الترجمة والتوطين:** ترجمات معتمدة تحافظ على المعنى الشرعي | نعرض ترجمة Saheeh International للآية عبر Quran.com مع الإسناد؛ لم نستخدم ترجمة آلية للنص القرآني. شرح أسباب الخطأ بالعربية فقط حاليًا | ⚠️ لم نتحقق من ترخيص الترجمة نفسها؛ ويمكن لاحقًا التحويل إلى ترجمات مجمع الملك فهد |
| **الخصوصية:** لا جمع لبيانات شخصية إلا بقدر الحاجة وبسياسة معلنة | الصوت يُفكّ ويُحلَّل في ذاكرة الخادم فقط (`io.BytesIO`) ولا يُكتب على القرص ولا يُحفظ، ولا حسابات ولا ملفات شخصية؛ والسياسة معلنة في README وفي الواجهة تحت زر التسجيل | ✅ |
| **التلاوات الصوتية:** مصدر معتمد للتلاوات | نستخدم EveryAyah (بث مباشر، غير تجاري، مع ذكر المصدر). المرجعية تذكر أيضًا مكتبة mp3quran.net (واجهة مجانية بلا مفتاح لأكثر من 230 قارئًا) | ⚠️ مقترح للمستقبل: الانتقال إلى mp3quran.net أو دعمه كبديل |
