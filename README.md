# AMARYT STORE

مستودع التطبيقات الخاص بمتجر AMARYT STORE.

## رابط إضافة المستودع إلى التطبيق

```text
https://raw.githubusercontent.com/Amaryt1/Mstoda/main/apps.json
```

## إضافة تطبيق جديد

1. ارفع ملف التطبيق بصيغة `.ipa` إلى GitHub Releases أو إلى مجلد `Apps` إذا كان حجمه ضمن حدود GitHub.
2. ارفع أيقونة التطبيق إلى مجلد `Icons`.
3. أضف بيانات التطبيق داخل مصفوفة `apps` في `apps.json` وفق القالب:

```json
{
  "name": "اسم التطبيق",
  "bundleIdentifier": "com.example.app",
  "developerName": "اسم المطور",
  "iconURL": "https://raw.githubusercontent.com/Amaryt1/Mstoda/main/Icons/app.png",
  "localizedDescription": "وصف التطبيق",
  "versions": [
    {
      "version": "1.0.0",
      "date": "2026-11-16T00:00:00Z",
      "downloadURL": "رابط-ملف-IPA-المباشر"
    }
  ]
}
```

مهم: يجب أن يكون `downloadURL` رابط تنزيل مباشر صالح لملف IPA، وأن يكون `bundleIdentifier` مطابقاً للتطبيق. لا تضع كلمات مرور أو مفاتيح خاصة في المستودع.
