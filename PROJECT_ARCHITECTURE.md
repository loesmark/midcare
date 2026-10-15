# 🗺️ خريطة مشروع MediCare Backend الشاملة

> **Next.js 16 + Prisma (SQLite) + JWT** — لوحة تحكم الطبيب + الـ API الذي يتعامل معه تطبيق Flutter.

هذه الوثيقة توضّح **كل مجلد وكل ملف** في المشروع مع شرح مختصر لمهمته الأساسية. تُحدَّث مع كل تعديل جوهري على البنية.

---

## 📁 الجذر (Project Root)

| المسار | النوع | المهمة |
|---|---|---|
| `package.json` | إعدادات | تعريف الحزم (Dependencies)، سكربتات npm (`dev`, `build`, `db:push`, `db:generate`, `seed`)، وبيانات المشروع. |
| `package-lock.json` | قفل | تثبيت نسخ الحزم لضمان تكرار البناء. |
| `tsconfig.json` | إعدادات | إعدادات TypeScript: target ES2017, module ESNext, path alias `@/*` → `./src/*`. |
| `next.config.ts` | إعدادات | إعدادات Next.js (output standalone). |
| `tailwind.config.ts` | إعدادات | إعدادات Tailwind CSS (الألوان، الخطوط، RTL). |
| `postcss.config.mjs` | إعدادات | خط معالجة PostCSS (Tailwind + Autoprefixer). |
| `eslint.config.mjs` | إعدادات | قواعد ESLint. |
| `components.json` | إعدادات | إعدادات shadcn/ui (مولّد المكونات). |
| `.env.example` | نموذج | قالب المتغيرات البيئية (DATABASE_URL, JWT_SECRET, TELEGRAM_*, ADMIN_BACKUP_PASSCODE). |
| `.gitignore` | إعدادات | الملفات المستثناة من git (node_modules, .next, db/*.db, .env). |
| `setup.sh` | سكربت | سكربت تهيئة لنظام Linux (تثبيت الحزم + إنشاء قاعدة البيانات + Seed). |
| `README.md` | وثائق | دليل التشغيل السريع. |
| `FLUTTER_API_GUIDE.md` | وثائق | دليل واجهات الـ API لتطبيق Flutter (يهم مطوري الموبايل). |
| **`PROJECT_ARCHITECTURE.md`** | وثائق | **هذا الملف** — خريطة البنية الشاملة. |

---

## 📁 `prisma/` — قاعدة البيانات

| الملف | المهمة |
|---|---|
| `prisma/schema.prisma` | تعريف الـ Schema الكامل: 13 نموذج (User, PatientProfile, PatientDisease/Surgery/Medication, HealthRecord, PatientDocument, SymptomLog, Consultation, Appointment, TreatmentPlan, AlertThreshold, Alert, Setting, AuditLog, RequestLog) + 5 كتالوجات (Disease, Surgery, Symptom, Medication, ConsultationType) + WorkingHour. |
| `prisma/db/custom.db` | ملف قاعدة بيانات SQLite الفعلي (يُنشأ عند `prisma db push`). لا يُرفع في git. |

---

## 📁 `scripts/` — سكربتات الصيانة

| الملف | المهمة |
|---|---|
| `scripts/seed.ts` | تهيئة قاعدة البيانات ببيانات تجريبية: حساب الأدمن، 4 مرضى، إعدادات تيليجرام الافتراضية، عتبات افتراضية (BP 90-140, HR 50-100)، كتالوجات (أمراض، عمليات، أعراض، أدوية، أنواع استشارات)، مواعيد/استشارات تجريبية، وساعات عمل أسبوعية (الأحد–الخميس 9–17). |

---

## 📁 `public/` — الملفات الثابتة

| الملف | المهمة |
|---|---|
| `public/logo.svg` | شعار MediCare المعروض في لوحة التحكم. |
| `public/robots.txt` | تعليمات لمحركات البحث (disallow all). |
| `public/uploads/` | (يُنشأ تلقائياً) تخزين الملفات المرفوعة محلياً عند عدم تهيئة تيليجرام. |

---

## 📁 `src/lib/` — المكتبات المشتركة (Core Libraries)

هذه هي **قلب النظام** — كل الـ APIs تعتمد عليها.

| الملف | المهمة |
|---|---|
| `src/lib/db.ts` | **عميل Prisma مفرد (Singleton)** — يمنع فتح اتصالات كثيرة أثناء التطوير الساخن. يصدّر `db` المستخدم في كل مكان. |
| `src/lib/auth.ts` | **المصادقة JWT**: `signToken`, `verifyToken`, `getTokenFromRequest` (Bearer أو X-Auth-Token), `authenticate` (يتحقق من أن المستخدم نشط), `requireAuth` (أي مستخدم), `requireAdmin` (أدمن فقط). |
| `src/lib/api.ts` | **مغلف الاستجابات الموحّد**: `ok(data, msg)`, `created`, `paginate`, `apiError`, وقاموس `Err` (badRequest, unauthorized, forbidden, notFound, conflict, internal). أيضاً `pagination(req)` لقراءة ?page=&limit=. |
| `src/lib/api-client.ts` | **عميل HTTP للواجهة (frontend)**: `apiFetch<T>()` يضيف Bearer token، يرمي `ApiError` على !success، يتعامل مع 401 بمسح الجلسة. يخزّن token في localStorage. |
| `src/lib/telegram.ts` | **طبقة تيليجرام**: `getSettings/updateSettings/getTelegramConfig` (مع cache)، `sendTelegramMessage`, `uploadFileToTelegram` (صورة/ملف), `resolveTelegramFile` (file_id → URL). |
| `src/lib/alerts.ts` | **محرّك تنبيهات العتبات**: `evaluateReading()` يقارن قراءة المريض بالعتبات النشطة، ينشئ تنبيه واحداً لكل معامل خارج النطاق (مع dedup: لا تكرار طالما هناك تنبيه غير مقروء)، ويرسل إشعار تيليجرام لمجموعة التنبيهات. |
| **`src/lib/audit.ts`** ⭐ | **مسجّل التدقيق المركزي الجديد**: `logAudit({actorId, req, action, target, status, meta, notify})` يكتب صفًا في `AuditLog` + يدفع إشعار تيليجرام فوري لمجموعة التنبيهات لإجراءات SETTINGS_* و SECURITY_* و BACKUP_*. يحتوي على `diffSettings()` لبناء فرق before/after، و`clientIp()` لاستخراج IP من X-Forwarded-For. لا يرمي أخطاء أبداً (safe to call from hot paths). |
| `src/lib/utils.ts` | دوال مساعدة عامة (cn لدمج classNames). |

---

## 📁 `src/hooks/` — React Hooks

| الملف | المهمة |
|---|---|
| `src/hooks/use-mobile.ts` | Hook يكشف ما إذا كان العرض mobile. |
| `src/hooks/use-toast.ts` | Hook قديم لأنظمة toast (لم يعد مستخدماً بكثرة — شاشات الإعداد تستخدم `sonner` مباشرة). |

---

## 📁 `src/components/ui/` — مكونات shadcn/ui

45 مكون UI معاد (Card, Button, Input, Dialog, Tabs, Select, Table, Badge, Sheet, Toaster...). كلها مولّدة بواسطة shadcn/cli ومستخدمة في `src/components/admin/*`. لا داعي لشرح كل واحد — القائمة الكاملة:

`accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip`.

---

## 📁 `src/components/admin/` — شاشات لوحة التحكم

| الملف | المهمة |
|---|---|
| `shell.tsx` | **الإطار الرئيسي**: header (logo + مبدّل سريري/تقني + جرس التنبيهات + chip المستخدم + زر خروج) + sidebar (10 عناصر سريرية + 4 تقنية) + main area تُبدّل بين الـ Views. يستطلع `/admin/alerts/unread-count` كل 30 ثانية. |
| `login.tsx` | شاشة تسجيل دخول الأدمن (هاتف + كلمة مرور). تستدعي `/auth/doctor-login`. |
| `dashboard-view.tsx` | الصفحة الرئيسية: KPIs (عدد المرضى، التنبيهات غير المقروءة، الاستشارات المعلقة، المواعيد اليوم)، وصلات سريعة للأقسام. |
| `alerts-view.tsx` | **إدارة التنبيهات الطبية**: جدول paginated + فلترة (status/severity) + أزرار "مقروء"/"حل". |
| `patients-view.tsx` | **إدارة المرضى**: قائمة + بحث + تفاصيل المريض + سجل القراءات + إضافة قراءة نيابة عن المريض. |
| `consultations-view.tsx` | **الاستشارات**: جدول + فلترة status + dialog الرد (response_text + recommended_action + follow_up_date). يعرض الأعراض + وصف الأعراض المخصص + آخر قراءة كـ context. |
| `appointments-view.tsx` | **المواعيد**: قائمة + تأكيد/إلغاء. |
| `catalogs-view.tsx` | **الكتالوجات**: تبويبات للأمراض/العمليات/الأعراض/الأدوية/أنواع الاستشارات مع CRUD كامل. |
| `thresholds-view.tsx` | **عتبات التنبيه**: إدارة lower_bound/upper_bound لكل معامل. |
| `working-hours-view.tsx` | **ساعات العمل الأسبوعية**: تفعيل/تعطيل يوم + تعديل الفترة. |
| `profile-view.tsx` | **الملف الشخصي للأدمن**: تعديل الاسم + تغيير كلمة المرور. |
| **`settings-view.tsx`** ⭐ | **الإعدادات**: حقول (Bot Token, image group, alerts group, doctor WhatsApp) + زر حفظ يعرض **diff للتغييرات** + 3 أزرار اختبار (image/alert/whatsapp) تعرض **banner مميّز (أخضر للنجاح / أحمر للفشل) مع تفاصيل كاملة (chat_id, message_id, error_code, error_message, hint)**. |
| `tech-metrics-view.tsx` | **التقني — المقاييس**: إحصائيات الأداء (طلبات/ثانية، أبطأ endpoints). |
| `tech-logs-view.tsx` | **التقني — سجلات الطلبات**: تصفّح RequestLog. |
| **`tech-audit-view.tsx`** ⭐ | **التقني — سجل التدقيق**: تصفّح AuditLog + فلترة + **زر "تفاصيل" ي展开 الـ meta JSON كـ diff table (حقل/من/إلى)** + بيانات إضافية. |
| `tech-backup-view.tsx` | **التقني — النسخ الاحتياطي**: تحميل snapshot لقاعدة SQLite (يتطلب passcode). |
| `lightbox.tsx` | عارض صور مكبّر (يستخدم في سجل قراءات المريض). |

---

## 📁 `src/app/` — تطبيق Next.js (App Router)

### الجذر

| الملف | المهمة |
|---|---|
| `src/app/layout.tsx` | Root layout: يطبّق الخطوط + RTL + الـ providers. |
| `src/app/page.tsx` | الصفحة الجذرية: تعرض شاشة Login أو Shell حسب الجلسة. |
| `src/app/globals.css` | أنماط Tailwind العامة + متغيرات الثيم. |
| `src/app/health/route.ts` | `GET /health` — فحص صحة الخادم (يستخدمه Flutter لعرض "متصل؟"). |

### 📁 `src/app/api/v1/` — جميع واجهات الـ API

#### 🔐 `auth/` — المصادقة (5 routes)

| المسار | المهمة |
|---|---|
| `auth/doctor-login/route.ts` | **POST** — تسجيل دخول الأدمن (phone + password). ⭐ **مدقّق**: يكتب `SECURITY_LOGIN_SUCCESS`/`SECURITY_LOGIN_FAILED` + ينبّه تيليجرام عند الفشل. |
| `auth/patient-login/route.ts` | **POST** — دخول المريض عبر patient_token. ⭐ **مدقّق**: يكتب `SECURITY_LOGIN_*`. |
| `auth/patient-register/route.ts` | **POST** — تسجيل مريض جديد (name + phone). ⭐ **مدقّق**: يكتب `SECURITY_REGISTER`. |
| `auth/me/route.ts` | **GET** — بيانات المستخدم الحالي (تشمل patient_token). |
| `auth/password/route.ts` | **PUT** — تغيير كلمة المرور. ⭐ **مدقّق**: يكتب `SECURITY_PASSWORD_CHANGE` (نجاح/فشل) + ينبّه تيليجرام عند كلمة مرور حالية خاطئة. |
| `auth/profile/route.ts` | **GET/PUT** — ملف الأدمن الشخصي. |

#### 🩺 `admin/` — واجهات الأدمن (محمية بـ `requireAdmin`)

| المسار | المهمة |
|---|---|
| `admin/settings/route.ts` | **GET/PUT** — قراءة/حفظ إعدادات تيليجرام وواتساب. ⭐ **مدقّق مع diff كامل**: يحسب before/after لكل حقل، يكتب `SETTINGS_UPDATE`، وينبّه تيليجرام بالتغييرات بالتفصيل. |
| `admin/settings/test-image-group/route.ts` | **POST** — اختبار مجموعة الصور. ⭐ **استجابة منظّمة**: `{ok, sent_at, chat_id, message_id, error_code, error_message, hint}` + مدقّق. |
| `admin/settings/test-alert-group/route.ts` | **POST** — اختبار مجموعة التنبيهات. ⭐ نفس النمط المنظّم + مدقّق. |
| `admin/settings/test-whatsapp/route.ts` | **POST** — اختبار واتساب. ⭐ نفس النمط + مدقّق. |
| `admin/availability-status/route.ts` | **GET/PUT** — حالة توفّر الطبيب (active/off_today/after_hours_emergency). ⭐ **مدقّق** + أصلح bug الـ silent-ignore للحالات غير الصالحة. |
| `admin/working-hours/route.ts` | **GET/PUT** — ساعات العمل الأسبوعية. ⭐ **مدقّق مع diff**. |
| `admin/thresholds/route.ts` | **GET/POST** — قائمة/إنشاء/استبدال عتبات التنبيه. ⭐ **مدقّق مع diff**. |
| `admin/thresholds/[id]/route.ts` | **PUT/DELETE** — تعديل/حذف عتبة. ⭐ **مدقّق**. |
| `admin/catalogs/diseases/route.ts` + `[id]/route.ts` | **CRUD** للأمراض. ⭐ **مدقّق** (CATALOG_CREATE/UPDATE/DELETE). |
| `admin/catalogs/surgeries/route.ts` + `[id]/route.ts` | **CRUD** للعمليات. ⭐ **مدقّق**. |
| `admin/catalogs/symptoms/route.ts` + `[id]/route.ts` | **CRUD** للأعراض (مع is_critical). ⭐ **مدقّق**. |
| `admin/catalogs/medications/route.ts` + `[id]/route.ts` | **CRUD** للأدوية. ⭐ **مدقّق**. |
| `admin/catalogs/consultation-types/route.ts` + `[id]/route.ts` | **CRUD** لأنواع الاستشارات. ⭐ **مدقّق**. |
| `admin/appointments/route.ts` | **GET** — قائمة المواعيد (paginated). |
| `admin/appointments/[id]/confirm/route.ts` | **PATCH** — تأكيد موعد + توليد رابط واتساب. ⭐ **مدقّق**. |
| `admin/appointments/[id]/cancel/route.ts` | **PATCH** — إلغاء موعد. ⭐ **مدقّق**. |
| `admin/consultations/route.ts` | **GET** — قائمة الاستشارات. |
| `admin/consultations/[id]/respond/route.ts` | **PATCH** — رد الطبيب على استشارة (يخزّن `doctor_response` JSON منظم). ⭐ **مدقّق**. |
| `admin/patients/route.ts` | **GET** — قائمة المرضى. |
| `admin/patients/[id]/records/route.ts` | **GET** — سجل قراءات مريض. |
| `admin/patients/[id]/add-reading/route.ts` | **POST** — إضافة قراءة نيابة عن المريض (يُفعّل pipeline التنبيهات). |
| `admin/alerts/route.ts` | **GET** — قائمة التنبيهات (مع join اسم المريض). |
| `admin/alerts/[id]/read/route.ts` | **PATCH** — تعليم كمقروء. |
| `admin/alerts/[id]/resolve/route.ts` | **PATCH** — حل تنبيه. ⭐ **مدقّق** + أُصلح الـ helper المتعرّج. |
| `admin/alerts/unread-count/route.ts` | **GET** — عدد التنبيهات غير المقروءة (يستخدمه shell في الـ polling). |
| `admin/audit-logs/route.ts` | **GET** — قائمة سجل التدقيق (paginated + فلترة by action). |
| `admin/logs/route.ts` + `top-endpoints/` + `status-breakdown/` | **GET** — تقارير RequestLog. |
| `admin/metrics/route.ts` | **GET** — مقاييس الأداء. |
| `admin/backup-db/route.ts` | **POST** — تنزيل snapshot لقاعدة SQLite. ⭐ **مدقّق** (نجاح/فشل passcode/فشل قراءة). |
| `admin/backup-db/info/route.ts` | **GET** — معلومات الـ backup (حجم DB). |
| `admin/backup-db/helper.ts` | دوال مساعدة: `getDbPath()`, `getDbPathSize()`. |
| `admin/telegram-file/[fileId]/route.ts` | **GET** — تحميل ملف من تيليجرام (proxy آمن يحمل token server-side). |

#### 👤 `patient/` — واجهات المريض (محمية بـ `requireAuth` + role=patient)

| المسار | المهمة |
|---|---|
| `patient/profile/route.ts` | **GET/PUT** — الملف الطبي الكامل (birth_date, smoking, additional_info + selections: diseases/surgeries/medications). |
| `patient/profile/versions/route.ts` | **GET** — نسخ الملف السابقة. |
| `patient/records/route.ts` | **POST** (multipart) — رفع قراءة (BP + HR + ملفات) → يُفعّل pipeline التنبيهات. **GET** — سجل القراءات. |
| `patient/symptom-logs/route.ts` | **GET/POST** — سجل الأعراض المستقل (بدون قياسات). |
| `patient/consultations/route.ts` | **POST** (JSON أو multipart) — إنشاء استشارة (immediate/regular + type_id/custom_type + symptoms + custom_symptom_text + attachment). يبني `context` تلقائياً (آخر قراءة + freshness). **GET** — قائمة الاستشارات. |
| `patient/consultations/[id]/route.ts` | **GET** — استشارة واحدة (تشمل doctor_response + context). |
| `patient/appointments/route.ts` | **POST** — حجز موعد (يتحقق من ساعات العمل + حالة الطبيب). **GET** — قائمة المواعيد. |
| `patient/appointments/[id]/route.ts` | **DELETE** — إلغاء موعد (فقط إذا status=requested). |
| `patient/available-slots/route.ts` | **GET** — الفتحات المتاحة ليوم محدد (ساعات العمل − المحجوز). |
| `patient/working-hours/route.ts` | **GET** — ساعات عمل الطبيب + حالة التوفّر (للعرض في تطبيق المريض). |
| `patient/availability/route.ts` | **GET** — حالة توفّر الطبيب فقط. |
| `patient/alerts/route.ts` | **GET** — تنبيهات المريض (مولّدة من قراءاته). |
| `patient/alerts/[id]/read/route.ts` | **PATCH** — تعليم تنبيه كمقروء (لللبريد). |
| `patient/documents/route.ts` | **POST/GET** — رفع/سرد الوثائق (ECG/Echo/Lab). |
| `patient/documents/[id]/route.ts` | **GET** — وثيقة واحدة. |
| `patient/catalogs/diseases/route.ts` + `medications/` + `symptoms/` | **GET** — نسخ للقراءة فقط من الكتالوجات (alias للـ routes العامة). |

#### 📚 `catalogs/` — كتالوجات عامة للقراءة (patient + admin)

| المسار | المهمة |
|---|---|
| `catalogs/diseases/route.ts` | **GET** — قائمة الأمراض. |
| `catalogs/surgeries/route.ts` | **GET** — قائمة العمليات. |
| `catalogs/symptoms/route.ts` | **GET** — قائمة الأعراض (مع is_critical). |
| `catalogs/medications/route.ts` | **GET** — قائمة الأدوية. |
| `catalogs/consultation_types/route.ts` | **GET** — قائمة أنواع الاستشارات (with optional ?category= filter). |

#### ❌ `treatment-plans/route.ts`

| المسار | المهمة |
|---|---|
| `treatment-plans/route.ts` | **GET** — معطّل (يُرجع 410 Gone). النموذج محفوظ في Prisma لكن الـ routes معطّلة بناءً على قرار التصميم. |

---

## 🔄 تدفق البيانات النموذجي (Data Flow)

### تدفق رفع قراءة + توليد تنبيه
```
Flutter app
  → POST /api/v1/patient/records (multipart: bp_systolic, bp_diastolic, heart_rate, files[])
    → requireAuth (يتحقق JWT)
    → يرفع الملفات لتيليجرام (أو محلياً)
    → db.healthRecord.create
    → evaluateReading() [src/lib/alerts.ts]
      → يحمل العتبات النشطة
      → لكل معامل خارج النطاق:
         → dedup (تخطّي إذا يوجد unread لنفس patient+param)
         → sendTelegramMessage للـ alerts group
         → db.alert.create
    → يُرجع {record_id, alerts_generated, alerts[]}
```

### تدفق تعديل إعداد + إشعار الأدمن
```
Admin UI (settings-view.tsx)
  → PUT /api/v1/admin/settings {telegram_bot_token, ...}
    → requireAdmin
    → getSettings() (before snapshot)
    → diffSettings(before, patch, KEYS) → [{key, from, to}, ...]
    → إذا diff فارغ → يُرجع "no changes" (لا spam)
    → updateSettings(patch) → يحدّث DB + يُبطل cache
    → logAudit({
        action: "SETTINGS_UPDATE",
        target: "settings",
        meta: { diff, changed_count, changed_keys },
        notify: true  // افتراضي لـ SETTINGS_*
      })
      → db.auditLog.create
      → sendTelegramMessage إلى alerts group:
         "✅ إجراء إداري — نجاح
          📋 النوع: تحديث الإعدادات
          🎯 الهدف: settings
          👤 المستخدم: <last 8 chars>
          🌐 IP: <ip>
          📝 التغييرات:
             • telegram_bot_token: ••••••
             • doctor_whatsapp: 20100... ← 20200...
          🕐 <timestamp>"
    → يُرجع {settings, changed_keys, changed_count}
```

### تدفق اختبار مجموعة التنبيهات
```
Admin UI
  → POST /api/v1/admin/settings/test-alert-group
    → requireAdmin
    → getTelegramConfig()
    → إذا botToken ناقص:
         → logAudit (failure) → يُرجع {ok:false, error_code:"BOT_TOKEN_MISSING", error_message, hint}
    → إذا alertsChatId ناقص:
         → logAudit (failure) → يُرجع {ok:false, error_code:"ALERTS_CHAT_ID_MISSING", ...}
    → sendTelegramMessage
    → إذا فشل:
         → logAudit (failure) → يُرجع {ok:false, error_code:"TELEGRAM_API_ERROR", error_message, hint}
    → logAudit (success) → يُرجع {ok:true, sent_at, chat_id, message_id, telegram_response}
  → الواجهة تُظهر banner مميّز:
     ✓ أخضر مع تفاصيل عند النجاح
     ✗ أحمر مع error_code + hint عند الفشل
```

---

## 🔌 النقاط الحساسة المُؤمَّنة بالتدقيق

| النقطة | الإجراء المُسجّل | إشعار تيليجرام |
|---|---|---|
| حفظ الإعدادات | `SETTINGS_UPDATE` + diff | ✅ افتراضي |
| تغيير حالة توفّر الطبيب | `SETTINGS_AVAILABILITY` | ✅ افتراضي |
| تعديل ساعات العمل | `WORKING_HOURS_UPDATE` + diff | ✅ يدوي |
| إنشاء/تعديل/حذف عتبة | `THRESHOLD_CREATE/UPDATE/DELETE` + diff | ✅ يدوي |
| CRUD على أي كتالوج | `CATALOG_CREATE/UPDATE/DELETE` + diff | ❌ (يُسجّل فقط) |
| تأكيد/إلغاء موعد | `APPOINTMENT_CONFIRM/CANCEL` | ❌ |
| الرد على استشارة | `CONSULTATION_RESPOND` | ❌ |
| حل تنبيه طبي | `ALERT_RESOLVE` | ❌ |
| تنزيل نسخة احتياطية (نجاح) | `BACKUP_DOWNLOAD` (success) | ✅ |
| تنزيل نسخة احتياطية (فشل passcode) | `BACKUP_DOWNLOAD` (failure) | ✅ |
| دخول أدمن ناجح | `SECURITY_LOGIN_SUCCESS` | ❌ (روتيني) |
| **دخول أدمن فاشل** | `SECURITY_LOGIN_FAILED` | ✅ (محاولة brute-force) |
| **تغيير كلمة مرور بـ current خاطئة** | `SECURITY_PASSWORD_CHANGE` (failure) | ✅ |
| تسجيل مريض جديد | `SECURITY_REGISTER` | ❌ |
| اختبار تيليجرام (نجاح/فشل) | `TELEGRAM_TEST_*` | ❌ |

---

## 🛠️ التشغيل

```bash
# 1. تثبيت الحزم
npm install

# 2. تهيئة قاعدة البيانات
cp .env.example .env
# عدّل DATABASE_URL و JWT_SECRET و ADMIN_BACKUP_PASSCODE
npx prisma generate
npx prisma db push --accept-data-loss

# 3. بيانات تجريبية
npx tsx scripts/seed.ts
# → Admin: 01000000000 / admin123

# 4. تشغيل
npm run dev   # ← http://localhost:3000
```

---

**آخر تحديث:** هذه النسخة تضيف **نظام تدقيق مركزي** + **إشعارات تيليجرام فورية لتعديلات الإعدادات** + **استجابات منظّمة لاختبارات تيليجرام** + **banner مميّز في الواجهة** + **عرض diff في سجل التدقيق**.
