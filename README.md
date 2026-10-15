# 🏥 MediCare — دليل التشغيل على الجهاز الشخصي

دليل كامل خطوة بخطوة لتنزيل وتشغيل مشروع MediCare على جهازك من الصفر.

> 📱 **لربط API بتطبيق Flutter/Mobile**، راجع ملف [FLUTTER_API_GUIDE.md](./FLUTTER_API_GUIDE.md) — يحتوي على:
> - فئة `Api` كاملة بـ Dart جاهزة للنسخ
> - كل المسارات (56 مسار: auth + patient + admin)
> - أمثلة عملية (تسجيل، قراءات، استشارات، مواعيد...)
> - إعدادات Android/iOS للشبكة
> - تدفق المصادقة ومعالجة الأخطاء

---

## 📋 المتطلبات الأساسية

قبل البدء، تأكد من تثبيت الأدوات التالية على جهازك:

| الأداة | الإصدار المطلوب | رابط التحميل | طريقة التحقق |
|--------|------------------|---------------|---------------|
| **Node.js** | 18.0 أو أحدث | https://nodejs.org | `node -v` |
| **Bun** | 1.0 أو أحدث | https://bun.sh | `bun -v` |
| **Git** | أي إصدار | https://git-scm.com | `git -v` |

### تثبيت Bun (إذا لم يكن مثبتاً)

**macOS / Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

بعد التثبيت، أعد فتح الطرفية وتحقق:
```bash
bun -v
```

---

## 📥 الخطوة 1: تنزيل ملفات المشروع

### الخيار أ) من مستودع Git (إذا رفعته على GitHub)

```bash
git clone https://github.com/USERNAME/medicare.git
cd medicare
```

### الخيار ب) نسخ المجلد يدوياً

انسخ مجلد المشروع كاملاً إلى جهازك. المجلدات والملفات **الضرورية** فقط:

```
medicare/
├── src/                          ← كل كود التطبيق
│   ├── app/                      ← صفحات Next.js + API routes
│   │   ├── api/v1/               ← مسارات الـ API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── admin/                ← مكونات لوحة التحكم
│   │   └── ui/                   ← مكونات shadcn/ui
│   ├── hooks/
│   └── lib/                      ← auth, db, telegram, alerts, api
├── prisma/
│   └── schema.prisma             ← مخطط قاعدة البيانات
├── public/                       ← الملفات الثابتة (logo, uploads)
├── scripts/
│   └── seed.ts                   ← سكربت بيانات تجريبية
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json
├── eslint.config.mjs
└── .env.example                  ← نموذج متغيرات البيئة
```

**❌ لا تنسخ هذه المجلدات** (تُولّد تلقائياً):
- `node_modules/`
- `.next/`
- `db/` (يُنشئها Prisma)
- `dev.log`

---

## ⚙️ الخطوة 2: إعداد متغيرات البيئة

```bash
# انسخ ملف المثال
cp .env.example .env
```

ثم افتح ملف `.env` بأي محرر نصوص وعدّل القيم:

### المهم تعديله:
```bash
# ضع مسار قاعدة البيانات (سيتنشأ تلقائياً)
DATABASE_URL=file:./db/custom.db

# ضروري: ضع قيمة عشوائية (شغّل الأمر التالي في طرفية أخرى):
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=ضع_هنا_القيمة_العشوائية_الطويلة
```

### اختياري (للتشغيل المحلي البسيط اتركها فارغة):
```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ALERTS_CHAT_ID=
```

---

## 📦 الخطوة 3: تثبيت الاعتمادات (Dependencies)

في مجلد المشروع:

```bash
bun install
```

سيقوم Bun بتنزيل كل الحزم المطلوبة (يستغرق 1-3 دقائق حسب سرعة الإنترنت).

### إذا واجهت أخطاء:

```bash
# امسح cache وأعد المحاولة
rm -rf node_modules bun.lock
bun install
```

---

## 🗄️ الخطوة 4: إعداد قاعدة البيانات

### 4أ) توليد Prisma Client

```bash
bun run db:generate
```

### 4ب) إنشاء الجداول في قاعدة البيانات

```bash
bun run db:push
```

سترى رسالة:
```
🚀 Your database is now in sync with your Prisma schema.
```

### 4ج) (اختياري) ملء قاعدة البيانات ببيانات تجريبية

```bash
bun run seed
```

ينشئ هذا:
- **أدمن**: `01000000000` / `admin123`
- **4 مرضى تجريبيين** مع سجلات صحية
- **عتبات افتراضية** (ضغط انقباضي/انبساطي، نبض)
- **كتالوجات**: أمراض، عمليات، أعراض، أدوية، أنواع استشارات
- **استشارات ومواعيد تجريبية**
- **ساعات عمل أسبوعية** (الأحد-الخميس)

---

## 🚀 الخطوة 5: تشغيل المشروع

### وضع التطوير (Recommended)

```bash
bun run dev
```

سترى:
```
▲ Next.js 16.1.3 (Turbopack)
- Local:        http://localhost:3000
✓ Ready in XXXms
```

افتح المتصفح على: **http://localhost:3000**

### تسجيل الدخول:
- **الهاتف**: `01000000000`
- **كلمة المرور**: `admin123`

---

## ✅ الخطوة 6: التحقق من التشغيل

### 6أ) تحقق من الواجهة
افتح http://localhost:3000 — يجب أن ترى شاشة تسجيل الدخول.

### 6ب) تحقق من API
في طرفية أخرى:
```bash
curl http://localhost:3000/api/v1/auth/doctor-login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"01000000000","password":"admin123"}'
```

يجب أن يرجع JSON يحتوي على `token`.

### 6ج) تحقق من جودة الكود
```bash
bun run lint
```

يجب أن يمر بدون أخطاء.

---

## 🎯 الأقسام المتوفرة في لوحة التحكم

### الوضع السريري (Clinical)
| القسم | الوصف |
|-------|-------|
| 🏠 الرئيسية | KPIs (مرضى، تنبيهات، سجلات، استشارات) |
| 🔔 التنبيهات | تنبيهات القياسات المتجاوزة للعتبات |
| 👥 المرضى | قائمة + تفاصيل + صور + إضافة قراءة |
| 🩺 الاستشارات | رد على استشارات المرضى |
| 📅 المواعيد | تأكيد/إلغاء المواعيد |
| 📚 الكتالوجات | أمراض/عمليات/أعراض/أدوية/أنواع استشارات |
| 📊 العتبات | lower_bound + upper_bound |
| 🕐 ساعات العمل | شبكة أسبوعية + حالة التوفر |
| 👤 الملف الشخصي | تعديل البيانات + كلمة المرور |
| ⚙️ الإعدادات | تيليجرام + واتساب + 3 أزرار اختبار |

### الوضع التقني (Technical)
| القسم | الوصف |
|-------|-------|
| 📈 المقاييس | صحة الخادم + إحصائيات |
| 📋 سجلات الطلبات | آخر الطلبات مع فلاتر |
| 🛡️ سجل التدقيق | الإجراءات الحساسة |
| 💾 النسخ الاحتياطي | تنزيل قاعدة البيانات |

---

## 🔧 إعداد تيليجرام (اختياري)

لتشغيل إرسال الصور والتنبيهات إلى تيليجرام:

### 1) أنشئ بوت
1. افتح تيليجرام وابحث عن **@BotFather**
2. أرسل `/newbot` واتبع التعليمات
3. احفظ الـ **Bot Token** (مثل: `123456789:ABCdef...`)

### 2) أنشئ مجموعتين
- **مجموعة الصور**: لرفع صور وملفات المرضى
- **مجموعة التنبيهات**: لاستقبال التنبيهات الحرجة

### 3) أضف البوت للمجموعتين كـ Administrator

### 4) احصل على Chat IDs
- أضف البوت **@userinfobot** للمجموعات
- سيطبع `chat_id` لكل مجموعة (مثل: `-1001234567890`)

### 5) حدّث ملف `.env`
```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_ALERTS_CHAT_ID=-1009876543210
```

### 6) أعد تشغيل السيرفر واختبر من قسم الإعدادات

---

## 🐛 حل المشاكل الشائعة

### المشكلة: `Cannot find module '...'`
```bash
rm -rf node_modules
bun install
```

### المشكلة: خطأ في Prisma (`Database connection error`)
```bash
# تأكد من مسار DATABASE_URL في .env
# امسح قاعدة البيانات وأعد إنشاؤها
rm -rf db/
bun run db:push
bun run seed
```

### المشكلة: المنفذ 3000 مستخدم
```bash
# استخدم منفذ آخر
bun run next dev -p 3001
```

### المشكلة: `next: not found`
```bash
# استخدم المسار المباشر
./node_modules/.bin/next dev -p 3000
```

### المشكلة: أخطاء TypeScript عند البناء
ملف `next.config.ts` مضبوط على `ignoreBuildErrors: true` لذا لا توقف البناء، لكن للتشغيل النظيف:
```bash
bun run lint
```

### المشكلة: الذاكرة المستهلكة عالية (OOM)
Next.js 16 مع Turbopack يستهلك ~2GB. على الأجهزة ذات الذاكرة المحدودة:
```bash
# استخدم webpack بدلاً من turbopack
next dev -p 3000 --no-turbopack
```

---

## 📜 الأوامر المتوفرة

| الأمر | الوصف |
|-------|-------|
| `bun run dev` | تشغيل وضع التطوير (مع Hot Reload) |
| `bun run lint` | فحص جودة الكود |
| `bun run db:push` | إنشاء/تحديث جداول قاعدة البيانات |
| `bun run db:generate` | توليد Prisma Client |
| `bun run db:reset` | حذف وإعادة إنشاء قاعدة البيانات |
| `bun run seed` | ملء قاعدة البيانات ببيانات تجريبية |
| `bun run build` | بناء نسخة الإنتاج |
| `bun run start` | تشغيل نسخة الإنتاج |

---

## 🗂️ بنية المشروع المختصرة

```
medicare/
├── src/
│   ├── app/
│   │   ├── api/v1/              ← Backend API (Next.js Route Handlers)
│   │   │   ├── auth/            ← doctor-login, patient-register, me, profile, password
│   │   │   ├── admin/           ← patients, alerts, thresholds, consultations, appointments,
│   │   │   │                       catalogs, working-hours, settings, logs, backup-db
│   │   │   ├── patient/         ← records, profile
│   │   │   └── treatment-plans/ ← معطّل (410 Gone)
│   │   ├── layout.tsx           ← الترويسة العامة
│   │   └── page.tsx             ← نقطة الدخول (login + dashboard)
│   ├── components/
│   │   ├── admin/               ← login, shell, dashboard, patients, alerts,
│   │   │                          thresholds, settings, consultations, appointments,
│   │   │                          catalogs, working-hours, profile, tech-* views
│   │   └── ui/                  ← shadcn/ui components
│   └── lib/
│       ├── auth.ts              ← JWT sign/verify + RBAC
│       ├── db.ts                ← Prisma client
│       ├── api.ts               ← response helpers (ok, paginate, Err)
│       ├── alerts.ts            ← تقييم العتبات + توليد التنبيهات + dedup
│       ├── telegram.ts          ← إرسال رسائل/ملفات تيليجرام
│       └── api-client.ts        ← client-side fetch helper
├── prisma/schema.prisma         ← مخطط قاعدة البيانات الكامل
├── scripts/seed.ts              ← بيانات تجريبية
└── .env                         ← متغيرات البيئة
```

---

## 🎉 تهانينا!

إذا وصلت إلى هنا، المشروع يعمل على جهازك بنجاح. افتح **http://localhost:3000** وسجّل الدخول بـ:
- **الهاتف**: `01000000000`
- **كلمة المرور**: `admin123`

للمساعدة أو الإبلاغ عن مشاكل، راجع قسم **حل المشاكل الشائعة** أعلاه.
