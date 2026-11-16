# AMARYT STORE

مستودع التطبيقات الذي يغذّي قسم **جديد** في تطبيق AMARYT STORE.

## رابط المستودع داخل التطبيق

`https://raw.githubusercontent.com/Amaryt1/Mstoda/main/apps.json`

التطبيق يقرأ هذا الملف تلقائياً عند فتح قسم **جديد**، ويمكنك السحب للأسفل لتحديث القائمة.

## ترتيب الملفات

ضع الملفات بهذا الترتيب:

```text
Mstoda/
├── apps.json                 ← أسماء التطبيقات ومعلوماتها وروابط الصور ونسخ IPA
├── Banners/
│   └── app-banner.jpg        ← صورة الخلفية العريضة للتطبيق
├── Icons/
│   └── app-icon.png          ← أيقونة التطبيق
└── Apps/
    └── app.ipa               ← ملف التطبيق (اختياري؛ الأفضل استخدام GitHub Releases للملفات الكبيرة)
```

**مهم:** اسم الملف والمسار في GitHub يجب أن يطابق الرابط المكتوب في `apps.json`. استخدم روابط Raw المباشرة للصور، مثل:
`https://raw.githubusercontent.com/Amaryt1/Mstoda/main/Banners/app-banner.jpg`

## إضافة تطبيق جديد

1. ارفع صورة الخلفية إلى مجلد `Banners`، ويفضل صورة أفقية بنسبة قريبة من 16:9.
2. ارفع أيقونة التطبيق إلى مجلد `Icons` بصيغة PNG أو JPG.
3. ارفع ملف IPA إلى GitHub Releases (مفضل للملفات الكبيرة)، أو إلى `Apps` إذا كان حجمه مناسباً لحدود GitHub.
4. افتح `apps.json` وأضف كائن التطبيق الجديد داخل مصفوفة `apps`، مع وضع فاصلة بين كل تطبيق والذي يليه.

## قالب جاهز للتطبيق

انسخ هذا القالب داخل مصفوفة `apps` وغيّر البيانات والروابط:

```json
{
  "name": "اسم التطبيق",
  "subtitle": "عنوان قصير يظهر تحت الاسم",
  "bundleIdentifier": "com.example.app",
  "developerName": "اسم المطور",
  "category": "Utilities",
  "localizedDescription": "اكتب هنا وصف التطبيق الكامل ومميزاته وطريقة استخدامه.",
  "iconURL": "https://raw.githubusercontent.com/Amaryt1/Mstoda/main/Icons/app-icon.png",
  "bannerURL": "https://raw.githubusercontent.com/Amaryt1/Mstoda/main/Banners/app-banner.jpg",
  "tintColor": "E84A5F",
  "screenshotURLs": [
    "https://raw.githubusercontent.com/Amaryt1/Mstoda/main/Banners/app-screen-1.jpg"
  ],
  "versions": [
    {
      "version": "1.0.0",
      "date": "2026-11-16T00:00:00Z",
      "downloadURL": "https://github.com/Amaryt1/Mstoda/releases/download/v1.0.0/app.ipa",
      "localizedDescription": "ما الجديد في هذا الإصدار؟"
    }
  ]
}
```

## أين أضع كل معلومة؟

| المطلوب | المكان |
|---|---|
| اسم التطبيق | `name` |
| العنوان القصير | `subtitle` |
| الوصف الكامل | `localizedDescription` |
| أيقونة التطبيق | ارفعها إلى `Icons` ثم ضع رابطها في `iconURL` |
| صورة الخلفية الكبيرة | ارفعها إلى `Banners` ثم ضع رابطها في `bannerURL` |
| لون البطاقة | يستخرج المتجر اللون تلقائياً من صورة الخلفية، ثم من الأيقونة إذا لم توجد خلفية. `tintColor` اختياري كلون احتياطي بصيغة HEX من دون `#` |
| رقم الإصدار | `versions[0].version` |
| تاريخ الإصدار | `versions[0].date` بصيغة ISO 8601 |
| رابط IPA | `versions[0].downloadURL` |
| اسم المطور | `developerName` |
| رقم تعريف التطبيق | `bundleIdentifier` ويجب أن يطابق التطبيق |
| التصنيف | `category` |
| صور إضافية | روابط داخل `screenshotURLs` |

## ملاحظات مهمة

- أحدث إصدار يوضع أولاً داخل مصفوفة `versions`.
- لا تضع رابط صفحة GitHub العادية للصورة؛ استخدم رابط Raw المباشر.
- يجب أن يكون رابط `downloadURL` رابط تنزيل مباشر صالحاً لملف IPA.
- إذا وضعت IPA داخل مجلد `Apps`، يكون الرابط مثلاً:
  `https://raw.githubusercontent.com/Amaryt1/Mstoda/main/Apps/app.ipa`
- GitHub يفرض حدوداً على حجم الملفات؛ لذلك Releases هو الخيار الأفضل لملفات IPA الكبيرة.
- لا تضع كلمات مرور أو مفاتيح خاصة أو شهادات توقيع داخل المستودع.
- بعد حفظ التعديلات في GitHub، افتح قسم **جديد** واسحب للأسفل لتحديث التطبيقات.

## إدارة التطبيقات من GitHub (من دون خدمات خارجية)

أُضيف سير عمل باسم **إدارة تطبيقات AMARYT STORE**. لا تحتاج إلى لوحة خارجية أو رمز وصول شخصي (PAT).

1. افتح [تبويب Actions في المستودع](https://github.com/Amaryt1/Mstoda/actions).
2. اختر **إدارة تطبيقات AMARYT STORE** من القائمة.
3. اضغط **Run workflow**.
4. اختر العملية: `add` للإضافة، `update` للتعديل، `hide` للإخفاء، `show` لإعادة الإظهار، أو `delete` للحذف.
5. أدخل `Bundle Identifier` للتطبيق. عند الإضافة أدخل الاسم، وعند إضافة إصدار جديد أدخل رقم الإصدار ورابط IPA.
6. املأ الحقول التي تريد تغييرها فقط، ثم شغّل العملية. سيحدّث GitHub ملف `apps.json` ويحفظ التغيير تلقائياً.

**الترتيب:** أدخل رقماً في `sort_order`؛ الرقم الأصغر يظهر أولاً. اتركه فارغاً للإبقاء على الترتيب الحالي.

**الصور:** ارفع الأيقونة إلى `Icons/` وصورة الخلفية إلى `Banners/` من واجهة GitHub أولاً، ثم أدخل رابط Raw المباشر في `icon_url` و`banner_url`. لا تضع ملفات IPA الكبيرة داخل Git؛ استخدم GitHub Releases.

**الأمان:** صلاحية الكتابة محصورة في سير العمل عبر `GITHUB_TOKEN` وبصلاحية `contents: write`. الدخول إلى GitHub والمصادقة الثنائية يحكمان من يستطيع تشغيله. لا تنشئ PAT ولا تضع أي كلمة مرور أو سر في الملفات.

التطبيقات المخفية تُنقل إلى `hiddenApps` داخل ملف البيانات، فلا تظهر في قسم «جديد»، ويمكن إعادتها باختيار `show`. لا تحذف `hiddenApps` يدوياً إذا أردت الاحتفاظ بإمكانية الاسترجاع.

### فحص رابط IPA قبل نشره

من تبويب Actions اختر **فحص رابط IPA** ثم **Run workflow** والصق رابط HTTPS المباشر. يفحص سير العمل إمكانية الوصول، وسلامة أرشيف ZIP، ووجود بنية `Payload/*.app/Info.plist`، ويعرض Bundle Identifier ورقم الإصدار.

هذا فحص بنية الملف فقط؛ لا يثبت أن شهادة التوقيع موثوقة أو أن IPA سيُثبت على كل جهاز. شغّل الفحص قبل إضافة رابط الإصدار إلى كتالوج التطبيقات.
