# 🔄 ربط الباكاند بـ Turso (LibSQL)

Turso هو خدمة قواعد بيانات SQLite موزّعة مبنية على libSQL (fork من SQLite). تسمح لك بنقل قاعدة بياناتك من ملف محلي إلى قاعدة بيانات سحابية مدارة مع تكرار (replicas) وتزامن edge حول العالم — مثالية لإنتاج (production).

هذا الدليل يشرح كيف تنقل مشروع **MediCare Dashboard** من SQLite المحلي إلى Turso خطوة بخطوة.

---

## ✅ المتطلبات المسبقة

- Node.js 18+ و npm.
- حساب Turso مجاني على [turso.tech](https://turso.tech).
- المشروع الحالي يعمل محلياً (تم التحقق منه بهذه النسخة).

---

## 1️⃣ تثبيت Turso CLI

```bash
# Linux / macOS / WSL
curl -sSfL https://get.tur.so/install.sh | bash

# أو عبر npm (يعمل على كل المنصات بما فيها Windows)
npm install -g @turso/cli

# تحقق من التثبيت
turso --version
```

---

## 2️⃣ تسجيل الدخول وإنشاء قاعدة بيانات

```bash
# تسجيل الدخول (يفتح المتصفح)
turso auth login

# أنشئ قاعدة بيانات جديدة باسم medicare
turso db create medicare

# اعرض معلومات الاتصال (URL + token)
turso db show medicare --url
# مثال المخرجات:
# libsql://medicare-<username>.turso.io

turso db tokens create medicare
# مثال المخرجات:
# eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

احفظ المخرجين (`url` و `token`) — سنستخدمهما في الخطوة التالية.

---

## 3️⃣ تثبيت حزمة `@libsql/client` و `@prisma/adapter-libsql`

```bash
cd medicare-dashboard
npm install @libsql/client @prisma/adapter-libsql
```

> **ملاحظة:** Prisma 6+ يدعم libSQL عبر محول رسمي (`@prisma/adapter-libsql`). لا حاجة لأي تعديل على الـ schema.

---

## 4️⃣ تعديل `prisma/schema.prisma`

غيّر الـ datasource من `sqlite` إلى `libsql`:

```prisma
// ❌ قبل التعديل (محلي)
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ✅ بعد التعديل (Turso)
datasource db {
  provider = "libsql"
  url      = env("TURSO_DATABASE_URL")
  authToken = env("TURSO_AUTH_TOKEN")
}
```

> **مهم:** لا تحتاج لتغيير أي model — الـ schema نفسه يعمل على SQLite و libSQL بدون تعديل.

---

## 5️⃣ تحديث ملف `.env`

افتح ملف `.env` (أو انسخه من `.env.example`) وعدّل القيم:

```bash
# ❌ قبل التعديل
DATABASE_URL=file:./db/custom.db

# ✅ بعد التعديل — استبدل بقيم Turso
TURSO_DATABASE_URL=libsql://medicare-<username>.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...

# أبقِ DATABASE_URL كـ fallback للتطوير المحلي (اختياري)
DATABASE_URL=file:./db/custom.db
JWT_SECRET=your-strong-secret-here
ADMIN_BACKUP_PASSCODE=your-passcode
```

---

## 6️⃣ تحديث `src/lib/db.ts` لاستخدام Turso adapter

افتح `src/lib/db.ts` واستبدل محتواه بالتالي:

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // إن وُجدت متغيرات Turso → استخدمها. وإلا فارجع لـ SQLite المحلي.
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    // ← مسار الإنتاج (Turso)
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter, log: ["error", "warn"] });
  }

  // ← مسار التطوير المحلي (SQLite file)
  return new PrismaClient({ log: ["error", "warn"] });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

هذا الإعداد يسمح لك بالتبديل بين المحلي و Turso بمجرد إضافة/إزالة المتغيرات البيئية — لا تعديل في الكود.

---

## 7️⃣ توليد Prisma client + دفع الـ schema

```bash
# أعد توليد عميل Prisma بـ libSQL adapter
npx prisma generate

# ادفع الـ schema إلى Turso (ينشئ كل الجداول)
npx prisma db push
```

> `db push` على Turso يقوم بإنشاء الجداول مباشرة. لا تستخدم `prisma migrate` ما لم تكن تحتاج تتبع migrations كامل.

---

## 8️⃣ (اختياري) ترحيل بياناتك الحالية من SQLite المحلي إلى Turso

إذا كانت لديك بيانات في `prisma/db/custom.db` وتريد نقلها:

```bash
# 1. صدّر البيانات من SQLite المحلي إلى ملف SQL
sqlite3 prisma/db/custom.db .dump > backup.sql

# 2. استوردها في Turso (يستخدم turso CLI ملف SQL مباشرة)
turso db shell medicare < backup.sql
```

> **تنبيه:** تأكد أن `backup.sql` لا يحتوي على `PRAGMA` خاصة بـ SQLite المحلي قبل الاستيراد. Turso يدعم معظم أوامر SQLite القياسية.

بعد الاستيراد، شغّل السكربت `seed.ts` فقط للجداول الناقصة:

```bash
npx tsx scripts/seed.ts
```

> السكربت يستخدم `upsert` / يتحقق من الوجود قبل الإدراج، لذلك آمن لإعادة التشغيل.

---

## 9️⃣ اختبر الاتصال

```bash
npm run dev
```

افتح `http://localhost:3000` → سجّل دخول الأدمن (`01000000000` / `admin123`). إذا تم تحميل لوحة التحكم وعرض المرضى/التنبيهات، فالاتصال بـ Turso يعمل.

للتأكد بصرياً، شغّل:

```bash
# سيعرض كل الجداول وعدد الصفوف في كل جدار
turso db shell medicare "SELECT 'users' AS tbl, COUNT(*) AS n FROM users
  UNION ALL SELECT 'patients', COUNT(*) FROM users WHERE role='patient'
  UNION ALL SELECT 'appointments', COUNT(*) FROM appointments
  UNION ALL SELECT 'alerts', COUNT(*) FROM alerts;"
```

---

## 🔟 نشر الإنتاج (Vercel / Railway / Fly.io)

عند رفع المشروع على منصة استضافة:

1. أضف متغيرات البيئة في لوحة التحكم بالاستضافة:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `JWT_SECRET`
   - `ADMIN_BACKUP_PASSCODE`
   - **لا تُضِف** `DATABASE_URL` (لإجبار الكود على استخدام Turso فقط في الإنتاج).

2. في أمر البناء (build command) أضف توليد Prisma:
   ```bash
   npx prisma generate && npm run build
   ```

3. (اختياري) أنشئ replica قريب من مستخدميك لتقليل latency:
   ```bash
   turso db replicate medicare fra  # فرانكفورت
   turso db replicate medicare sin  # سنغافورة
   ```
   تطبيقك سيقرأ تلقائياً من أقرب replica — لا حاجة لتعديل الكود.

---

## ⚠️ ملاحظات مهمة

1. **النسخ الاحتياطي (`/admin/backup-db`)**: هذا الـ route يقرأ ملف `custom.db` من القرص المحلي (`fs.readFileSync`). عند الانتقال إلى Turso، لن يعمل هذا الـ route لأن قاعدة البيانات لم تعد ملفاً محلياً. بدائل:
   - استخدم `turso db shell medicare .dump` عبر SSH في job منفصل.
   - أو صدّر البيانات عبر Prisma إلى JSON وتنزيلها كـ JSON.
   - أو استخدم [Turso's scheduled dumps](https://docs.turso.tech/platform/billing#included-backups) (يتم تلقائياً يومياً للخطط المدفوعة).

2. **حدود Turso المجانية**: خطة الـ Hobby تدعم 9 GB تخزين + 1 billion row reads/شهر. كافٍ تماماً لتطبيق طبي صغير/متوسط.

3. **Telegram file storage لا يتأثر**: التخزين في Turso هو لقاعدة البيانات (البيانات الوصفية). ملفات المرضى تظل مخزّنة في تيليجرام فقط (متطلب خصوصية لم نُخلّ به).

4. **Performance**: Turso أبطأ قليلاً من SQLite المحلي للـ writes (~50ms مقابل <1ms) بسبب round-trip الشبكة. للتطبيق الطبي هذا مقبول جداً. للقراءة، تستفيد من edge replicas.

---

## 📋 ملخص التعديلات المطلوبة للترحيل إلى Turso

| الملف | التعديل |
|---|---|
| `package.json` | إضافة `@libsql/client` و `@prisma/adapter-libsql` |
| `prisma/schema.prisma` | تغيير `provider` من `sqlite` إلى `libsql` + إضافة `authToken` |
| `.env` | إضافة `TURSO_DATABASE_URL` و `TURSO_AUTH_TOKEN` |
| `src/lib/db.ts` | استبدال `new PrismaClient()` بـ `createPrismaClient()` الذي يبني adapter libSQL عند توفر متغيرات Turso |
| **بدون تعديل** | كل الـ models في schema.prisma + كل الـ API routes + كل مكونات الـ admin — تعمل كما هي |

---

**ختاماً:** الترحيل إلى Turso يحتاج **4 ملفات فقط** للتعديل، ولا يكسر أي API متصل بتطبيق Flutter. التخزين في تيليجرام للملفات يبقى كما هو (متطلب خصوصية).
