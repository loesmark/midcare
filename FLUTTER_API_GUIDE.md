# 📱 دليل ربط API بتطبيق Flutter

دليل كامل لربط الـ API الخاص بـ MediCare بتطبيق Flutter. يشمل كل المسارات المتاحة + أمثلة كود Dart جاهزة.

---

## 🔗 الإعداد الأساسي

### 1) أضف الحزم إلى `pubspec.yaml`

```yaml
dependencies:
  flutter:
    sdk: flutter
  dio: ^5.4.0              # HTTP client
  flutter_secure_storage: ^9.0.0  # تخزين آمن للـ JWT
  image_picker: ^1.0.4     # اختيار الصور
  file_picker: ^6.1.1      # اختيار الملفات
```

### 2) أنشئ ملف `lib/services/api.dart`

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class Api {
  // 🔧 عدّل هذا إلى عنوان السيرفر عندك
  // محلي:    'http://10.0.2.2:3000/api/v1'   (Android Emulator)
  // محلي:    'http://localhost:3000/api/v1'  (iOS Simulator)
  // إنتاج:   'https://your-domain.com/api/v1'
  static const _base = 'http://10.0.2.2:3000/api/v1';

  final Dio _dio = Dio(BaseOptions(
    baseUrl: _base,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 30),
  ));

  final _storage = const FlutterSecureStorage();
  String? _jwt;
  String? _patientToken;

  Api() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (opts, handler) {
        if (_jwt != null) {
          opts.headers['Authorization'] = 'Bearer $_jwt';
        }
        handler.next(opts);
      },
      onError: (err, handler) {
        // 401 → مسح الجلسة وإعادة تسجيل الدخول
        if (err.response?.statusCode == 401) {
          clearSession();
        }
        handler.next(err);
      },
    ));
  }

  // ── تحميل الجلسة المحفوظة عند بدء التطبيق ──
  Future<void> loadSession() async {
    _jwt = await _storage.read(key: 'jwt');
    _patientToken = await _storage.read(key: 'patient_token');
  }

  Future<void> _saveSession() async {
    if (_jwt != null) await _storage.write(key: 'jwt', value: _jwt);
    if (_patientToken != null) await _storage.write(key: 'patient_token', value: _patientToken);
  }

  Future<void> clearSession() async {
    _jwt = null;
    _patientToken = null;
    await _storage.deleteAll();
  }

  bool get isLoggedIn => _jwt != null;
  String? get patientToken => _patientToken;

  // ═══════════════════════════════════════════
  //  AUTH
  // ═══════════════════════════════════════════

  /// تسجيل مريض جديد
  Future<Map<String, dynamic>> patientRegister({
    required String name,
    required String phone,
    String? birthDate,
    String? smokingStatus, // never | former | current
    String? additionalInfo,
  }) async {
    final r = await _dio.post('/auth/patient-register', data: {
      'name': name,
      'phone_number': phone,
    });
    final d = r.data['data'];
    _jwt = d['jwt'];
    _patientToken = d['patient_token'];
    await _saveSession();

    // تحديث الملف بعد التسجيل
    if (birthDate != null || smokingStatus != null || additionalInfo != null) {
      await updateProfile(
        birthDate: birthDate,
        smokingStatus: smokingStatus,
        additionalInfo: additionalInfo,
      );
    }
    return d;
  }

  /// تسجيل دخول المريض بـ patient_token
  Future<Map<String, dynamic>> patientLogin(String token) async {
    final r = await _dio.post('/auth/patient-login', data: {'patient_token': token});
    _jwt = r.data['data']['jwt'];
    _patientToken = token;
    await _saveSession();
    return r.data['data'];
  }

  /// بيانات المستخدم الحالي
  Future<Map<String, dynamic>> me() async {
    final r = await _dio.get('/auth/me');
    return r.data['data'];
  }

  /// تحديث الملف الشخصي
  Future<Map<String, dynamic>> updateProfile({
    String? name,
    String? phone,
  }) async {
    final r = await _dio.put('/auth/profile', data: {
      if (name != null) 'name': name,
      if (phone != null) 'phone_number': phone,
    });
    return r.data['data'];
  }

  /// تغيير كلمة المرور
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _dio.put('/auth/password', data: {
      'current_password': currentPassword,
      'new_password': newPassword,
    });
  }

  // ═══════════════════════════════════════════
  //  PROFILE (ملف المريض الطبي)
  // ═══════════════════════════════════════════

  /// عرض الملف الطبي
  Future<Map<String, dynamic>> getProfile() async {
    final r = await _dio.get('/patient/profile');
    return r.data['data'];
  }

  /// تحديث الملف الطبي (تاريخ الميلاد، التدخين، معلومات إضافية)
  Future<Map<String, dynamic>> updateMedicalProfile({
    String? birthDate, // ISO: "1990-05-15"
    String? smokingStatus, // never | former | current
    String? additionalInfo,
  }) async {
    final r = await _dio.put('/patient/profile', data: {
      if (birthDate != null) 'birth_date': birthDate,
      if (smokingStatus != null) 'smoking_status': smokingStatus,
      if (additionalInfo != null) 'additional_info': additionalInfo,
    });
    return r.data['data'];
  }

  // ═══════════════════════════════════════════
  //  HEALTH RECORDS (القياسات + المرفقات)
  // ═══════════════════════════════════════════

  /// إضافة قراءة جديدة (مع optional صور/ملفات)
  Future<Map<String, dynamic>> addRecord({
    int? bpSystolic,
    int? bpDiastolic,
    int? heartRate,
    String? notes,
    List<File> files = const [],
  }) async {
    final form = FormData();
    if (bpSystolic != null) form.fields.add(MapEntry('bp_systolic', bpSystolic.toString()));
    if (bpDiastolic != null) form.fields.add(MapEntry('bp_diastolic', bpDiastolic.toString()));
    if (heartRate != null) form.fields.add(MapEntry('heart_rate', heartRate.toString()));
    if (notes != null) form.fields.add(MapEntry('notes', notes));
    for (final f in files) {
      form.files.add(MapEntry('files', await MultipartFile.fromFile(f.path)));
    }
    final r = await _dio.post('/patient/records', data: form);
    return r.data['data'];
  }

  /// سجل القراءات (مصفوفة)
  Future<List<dynamic>> listRecords({int page = 1, int limit = 20}) async {
    final r = await _dio.get('/patient/records', queryParameters: {'page': page, 'limit': limit});
    return r.data['data'];
  }

  // ═══════════════════════════════════════════
  //  SYMPTOM LOGS (تسجيل الأعراض)
  // ═══════════════════════════════════════════

  /// تسجيل أعراض (إذا كان عرض حرِج → تنبيه فوري للطبيب)
  Future<Map<String, dynamic>> addSymptomLog({
    required List<Map<String, dynamic>> symptoms, // [{name, is_critical}]
    String? customText,
  }) async {
    final r = await _dio.post('/patient/symptom-logs', data: {
      'symptoms': symptoms,
      if (customText != null) 'custom_text': customText,
    });
    return r.data['data'];
  }

  /// سجل الأعراض السابقة
  Future<List<dynamic>> listSymptomLogs({int page = 1, int limit = 20}) async {
    final r = await _dio.get('/patient/symptom-logs', queryParameters: {'page': page, 'limit': limit});
    return r.data['data'];
  }

  // ═══════════════════════════════════════════
  //  DOCUMENTS (مستندات ECG/Echo/تحاليل)
  // ═══════════════════════════════════════════

  /// رفع مستند طبي
  /// type: 'ecg' | 'echo' | 'lab' | 'other'
  Future<Map<String, dynamic>> uploadDocument({
    required String type,
    required String title,
    String? notes,
    String? takenAt, // ISO date
    required List<File> files,
  }) async {
    final form = FormData();
    form.fields.add(MapEntry('type', type));
    form.fields.add(MapEntry('title', title));
    if (notes != null) form.fields.add(MapEntry('notes', notes));
    if (takenAt != null) form.fields.add(MapEntry('taken_at', takenAt));
    for (final f in files) {
      form.files.add(MapEntry('files', await MultipartFile.fromFile(f.path)));
    }
    final r = await _dio.post('/patient/documents', data: form);
    return r.data['data'];
  }

  /// قائمة المستندات
  Future<List<dynamic>> listDocuments({int page = 1, int limit = 20}) async {
    final r = await _dio.get('/patient/documents', queryParameters: {'page': page, 'limit': limit});
    return r.data['data'];
  }

  // ═══════════════════════════════════════════
  //  CONSULTATIONS (الاستشارات)
  // ═══════════════════════════════════════════

  /// طلب استشارة (عاجلة → يرجع whatsapp_link)
  Future<Map<String, dynamic>> requestConsultation({
    required String category, // 'immediate' | 'regular'
    required String reason,
  }) async {
    final r = await _dio.post('/patient/consultations', data: {
      'category': category,
      'reason': reason,
    });
    return r.data['data'];
  }

  /// سجل الاستشارات
  Future<List<dynamic>> listConsultations({int page = 1, int limit = 20}) async {
    final r = await _dio.get('/patient/consultations', queryParameters: {'page': page, 'limit': limit});
    return r.data['data'];
  }

  // ═══════════════════════════════════════════
  //  APPOINTMENTS (المواعيد)
  // ═══════════════════════════════════════════

  /// طلب موعد
  Future<Map<String, dynamic>> requestAppointment({
    required String scheduledDate, // "2025-01-20"
    required String scheduledTime, // "14:30"
    String? notes,
  }) async {
    final r = await _dio.post('/patient/appointments', data: {
      'scheduled_date': scheduledDate,
      'scheduled_time': scheduledTime,
      if (notes != null) 'notes': notes,
    });
    return r.data['data'];
  }

  /// قائمة المواعيد
  Future<List<dynamic>> listAppointments({int page = 1, int limit = 20}) async {
    final r = await _dio.get('/patient/appointments', queryParameters: {'page': page, 'limit': limit});
    return r.data['data'];
  }

  // ═══════════════════════════════════════════
  //  ALERTS (تنبيهات المريض)
  // ═══════════════════════════════════════════

  /// تنبيهات المريض (التي تولّدت من قراءاته)
  Future<List<dynamic>> listAlerts({String? status}) async {
    final r = await _dio.get('/patient/alerts', queryParameters: {
      if (status != null) 'status': status,
    });
    return r.data['data'];
  }

  // ═══════════════════════════════════════════
  //  CATALOGS (لإعداد الملف — اختيار الأمراض/الأعراض/الأدوية)
  // ═══════════════════════════════════════════

  Future<List<dynamic>> listDiseases() async {
    final r = await _dio.get('/patient/catalogs/diseases');
    return r.data['data'];
  }

  Future<List<dynamic>> listSymptoms() async {
    final r = await _dio.get('/patient/catalogs/symptoms');
    return r.data['data'];
  }

  Future<List<dynamic>> listMedications() async {
    final r = await _dio.get('/patient/catalogs/medications');
    return r.data['data'];
  }

  // ═══════════════════════════════════════════
  //  AVAILABILITY (حالة الطبيب + ساعات العمل)
  // ═══════════════════════════════════════════

  /// حالة الطبيب الآن + ساعات العمل الأسبوعية
  Future<Map<String, dynamic>> getAvailability() async {
    final r = await _dio.get('/patient/availability');
    return r.data['data'];
  }
}
```

### 3) سجّل الـ Api كـ singleton

في `main.dart`:

```dart
final api = Api();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await api.loadSession(); // تحميل الجلسة المحفوظة
  runApp(MyApp());
}
```

---

## 📋 جدول كل مسارات الـ API

### 🔐 المصادقة (Auth) — 6 مسارات

| Method | Path | Body | الاستخدام |
|--------|------|------|-----------|
| POST | `/auth/patient-register` | `{name, phone_number}` | تسجيل مريض جديد → يرجع `patient_token` + `jwt` |
| POST | `/auth/patient-login` | `{patient_token}` | تسجيل دخول بـ patient_token |
| GET | `/auth/me` | — | بيانات المستخدم الحالي |
| PUT | `/auth/profile` | `{name?, phone_number?}` | تحديث الاسم/الهاتف |
| PUT | `/auth/password` | `{current_password, new_password}` | تغيير كلمة المرور |
| POST | `/auth/doctor-login` | `{phone_number, password}` | للأطباء (لوحة الأدمن) |

### 👤 الملف الطبي (Patient Profile) — 2 مسار

| Method | Path | الاستخدام |
|--------|------|-----------|
| GET | `/patient/profile` | عرض الملف (تاريخ الميلاد، التدخين، معلومات) |
| PUT | `/patient/profile` | تحديث الملف الطبي |

### 💓 القراءات الصحية (Health Records) — 2 مسار

| Method | Path | Body | الاستخدام |
|--------|------|------|-----------|
| POST | `/patient/records` | multipart: `bp_systolic, bp_diastolic, heart_rate, notes, files[]` | إضافة قراءة + صور (تُقيّم تلقائياً بالعتبات) |
| GET | `/patient/records?page=&limit=` | — | سجل القراءات |

### 🤒 سجل الأعراض (Symptom Logs) — 2 مسار

| Method | Path | Body | الاستخدام |
|--------|------|------|-----------|
| POST | `/patient/symptom-logs` | `{symptoms: [{name, is_critical}], custom_text?}` | تسجيل أعراض (حرِج → تنبيه فوري للطبيب) |
| GET | `/patient/symptom-logs?page=&limit=` | — | سجل الأعراض |

### 📄 المستندات (Documents) — 2 مسار

| Method | Path | Body | الاستخدام |
|--------|------|------|-----------|
| POST | `/patient/documents` | multipart: `type, title, notes, taken_at, files[]` | رفع ECG/Echo/تحاليل |
| GET | `/patient/documents?page=&limit=` | — | قائمة المستندات |

### 🩺 الاستشارات (Consultations) — 2 مسار

| Method | Path | Body | الاستخدام |
|--------|------|------|-----------|
| POST | `/patient/consultations` | `{category: immediate\|regular, reason}` | طلب استشارة (عاجلة → whatsapp_link) |
| GET | `/patient/consultations?page=&limit=` | — | سجل الاستشارات |

### 📅 المواعيد (Appointments) — 2 مسار

| Method | Path | Body | الاستخدام |
|--------|------|------|-----------|
| POST | `/patient/appointments` | `{scheduled_date, scheduled_time, notes?}` | طلب موعد (يتحقق من ساعات العمل) |
| GET | `/patient/appointments?page=&limit=` | — | قائمة المواعيد |

### 🔔 التنبيهات (Alerts) — 1 مسار

| Method | Path | الاستخدام |
|--------|------|-----------|
| GET | `/patient/alerts?page=&limit=&status=` | تنبيهات المريض (المتولّدة من قراءاته) |

### 📚 الكتالوجات (Catalogs) — 3 مسارات (قراءة فقط)

| Method | Path | الاستخدام |
|--------|------|-----------|
| GET | `/patient/catalogs/diseases` | قائمة الأمراض (لإعداد الملف) |
| GET | `/patient/catalogs/symptoms` | قائمة الأعراض (مع `is_critical`) |
| GET | `/patient/catalogs/medications` | قائمة الأدوية |

### 🕐 حالة الطبيب (Availability) — 1 مسار

| Method | Path | الاستخدام |
|--------|------|-----------|
| GET | `/patient/availability` | حالة الطبيب + ساعات العمل الأسبوعية |

---

## 🎯 أمثلة استخدام عملية

### مثال 1: تسجيل مريض جديد + إعداد الملف

```dart
try {
  // 1) تسجيل
  final reg = await api.patientRegister(
    name: 'محمد أحمد',
    phone: '01012345678',
  );
  print('✅ تم التسجيل. patient_token: ${reg['patient_token']}');

  // 2) إعداد الملف الطبي
  await api.updateMedicalProfile(
    birthDate: '1985-04-12',
    smokingStatus: 'former',
    additionalInfo: 'مريض سكري + ضغط',
  );
} on DioException catch (e) {
  print('❌ خطأ: ${e.response?.data['error']['message']}');
}
```

### مثال 2: إضافة قراءة + صور ECG

```dart
import 'package:image_picker/image_picker.dart';

final picker = ImagePicker();
final images = await picker.pickMultiImage(limit: 3);

final result = await api.addRecord(
  bpSystolic: 145,
  bpDiastolic: 92,
  heartRate: 88,
  notes: 'بعد الرياضة',
  files: images.map((x) => File(x.path)).toList(),
);

print('✅ تم الحفظ');
print('🔔 تنبيهات مولّدة: ${result['alerts_count']}');
for (final a in result['alerts_generated']) {
  print('   - ${a['parameter_name']} = ${a['value']} (${a['severity']})');
}
```

### مثال 3: تسجيل عرض حرِج

```dart
final result = await api.addSymptomLog(
  symptoms: [
    {'name': 'ألم صدر', 'is_critical': true},
    {'name': 'ضيق تنفس', 'is_critical': true},
  ],
  customText: 'يبدأ بعد الأكل',
);

if (result['critical_alert_sent']) {
  // اعرض للمريض رسالة "تم إبلاغ الطبيب"
  showDialog(...);
}
```

### مثال 4: طلب استشارة عاجلة + فتح واتساب

```dart
final consultation = await api.requestConsultation(
  category: 'immediate',
  reason: 'ألم شديد في الصدر',
);

if (consultation['whatsapp_link'] != null) {
  final url = Uri.parse(consultation['whatsapp_link']);
  if (await canLaunchUrl(url)) {
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }
}
```

### مثال 5: طلب موعد (مع التحقق من التوفر)

```dart
// اعرض للمريض الأوقات المتاحة أولاً
final avail = await api.getAvailability();
if (!avail['is_available_now']) {
  print('الطبيب غير متاح الآن');
}

// اطلب موعد
try {
  final appt = await api.requestAppointment(
    scheduledDate: '2025-01-25',
    scheduledTime: '10:30',
    notes: 'متابعة شهرية',
  );
  print('✅ تم طلب الموعد، الحالة: ${appt['status']}');
} on DioException catch (e) {
  if (e.response?.data['error']['code'] == 'OUTSIDE_WORKING_HOURS') {
    print('⚠️ الطبيب غير متاح بهذا الوقت');
  }
}
```

### مثال 6: عرض شارة التنبيهات في الـ AppBar

```dart
class AlertsBadge extends StatefulWidget {
  @override
  _AlertsBadgeState createState() => _AlertsBadgeState();
}

class _AlertsBadgeState extends State<AlertsBadge> {
  int _unread = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _fetchUnread();
    _timer = Timer.periodic(Duration(minutes: 1), (_) => _fetchUnread());
  }

  Future<void> _fetchUnread() async {
    final alerts = await api.listAlerts(status: 'unread');
    final total = alerts.length;
    // أو استخدم pagination من الـ response
    if (mounted) setState(() => _unread = total);
  }

  @override
  Widget build(BuildContext context) {
    return Badge(
      label: Text('$_unread'),
      isLabelVisible: _unread > 0,
      child: Icon(Icons.notifications),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
```

---

## 🌐 إعدادات الشبكة (Android / iOS)

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<manifest ...>
    <!-- إذن الإنترنت -->
    <uses-permission android:name="android.permission.INTERNET" />
    
    <application
        android:usesCleartextTraffic="true"
        ...>
        ...
    </application>
</manifest>
```

> `usesCleartextTraffic="true"` ضروري للتطوير المحلي (HTTP بدون HTTPS).

### iOS — `ios/Runner/Info.plist`

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

---

## 🔑 تدفق المصادقة (Auth Flow)

```
┌─────────────────────────────────────────────────────────┐
│  أول مرة:                                               │
│  1) patient-register → يرجع patient_token + jwt        │
│  2) احفظ patient_token في flutter_secure_storage       │
│  3) حدّث الملف الطبي (birth_date, smoking_status...)    │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  مرات لاحقة:                                            │
│  1) load patient_token من التخزين                       │
│  2) patient-login(patient_token) → يرجع jwt جديد       │
│  3) كل الطلبات تستخدم: Authorization: Bearer <jwt>     │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  انتهاء صلاحية JWT (401):                               │
│  → أعد patient-login بنفس patient_token                │
│  → إذا فشل → اطلب من المستخدم إعادة التسجيل            │
└─────────────────────────────────────────────────────────┘
```

---

## ⚠️ معالجة الأخطاء

كل الأخطاء تتبع نفس الصيغة:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "reason is required."
  }
}
```

### رموز الأخطاء الشائعة

| Code | المعنى | الإجراء |
|------|--------|---------|
| `AUTH_REQUIRED` | لا يوجد JWT | أعد تسجيل الدخول |
| `AUTH_FORBIDDEN` | المريض يحاول الوصول لمسار أدمن | — |
| `VALIDATION_FAILED` | بيانات ناقصة | اعرض `message` للمستخدم |
| `OUTSIDE_WORKING_HOURS` | الموعد خارج ساعات العمل | اعرض الأوقات المتاحة |
| `DOCTOR_OFF_TODAY` | الطبيب في إجازة | اعرض رسالة مناسبة |
| `TREATMENT_PLANS_DISABLED` | مسارات الخطة العلاجية معطّلة | — |

### مثال معالجة شامل:

```dart
try {
  await api.addRecord(bpSystolic: 145, ...);
} on DioException catch (e) {
  final err = e.response?.data?['error'];
  if (err == null) {
    showSnack('خطأ شبكي');
  } else if (err['code'] == 'AUTH_REQUIRED') {
    // أعد تسجيل الدخول
    Navigator.pushReplacementNamed(context, '/login');
  } else {
    showSnack(err['message']);
  }
}
```

---

## ✅ قائمة تحقق قبل الإطلاق

- [ ] ضبط `baseUrl` في `api.dart` على عنوان السيرفر الإنتاجي
- [ ] تفعيل HTTPS على السيرفر
- [ ] إزالة `usesCleartextTraffic` في إصدار الإنتاج
- [ ] اختبار تدفق: register → login → add record → get alerts
- [ ] اختبار رفع الملفات (صور + PDF)
- [ ] اختبار طلب موعد + استشارة عاجلة (واتساب)
- [ ] معالجة 401 بإعادة تسجيل الدخول تلقائياً
- [ ] إظهار شارة التنبيهات في الـ AppBar
