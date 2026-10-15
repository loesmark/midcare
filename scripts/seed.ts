/**
 * Seed script — creates the initial admin, a few demo patients, health records
 * (with sample images), default thresholds (lower_bound + upper_bound), and
 * base settings.
 *
 * Run with: bun run seed
 */
import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

async function main() {
  console.log("🌱 Seeding database…");

  // ── Admin ──
  const adminPass = bcrypt.hashSync("admin123", 10);
  const admin = await db.user.upsert({
    where: { phoneNumber: "01000000000" },
    update: {},
    create: {
      id: uuidv4(),
      name: "د. أحمد الطبيب",
      phoneNumber: "01000000000",
      passwordHash: adminPass,
      role: "admin",
      status: "active",
    },
  });
  console.log("  ✓ admin:", admin.name, admin.phoneNumber);

  // ── Default settings ──
  const defaultSettings: Record<string, string> = {
    telegram_bot_token: "",
    telegram_chat_id: "",
    telegram_alerts_chat_id: "",
    doctor_whatsapp: "201000000000",
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }
  console.log("  ✓ settings seeded");

  // ── Default thresholds (Task 3: lower_bound + upper_bound) ──
  const defaultThresholds = [
    { parameterName: "bp_systolic", lowerBound: 90, upperBound: 140 },
    { parameterName: "bp_diastolic", lowerBound: 60, upperBound: 90 },
    { parameterName: "heart_rate", lowerBound: 50, upperBound: 100 },
  ];
  for (const t of defaultThresholds) {
    const existing = await db.alertThreshold.findFirst({
      where: { parameterName: t.parameterName },
    });
    if (!existing) {
      await db.alertThreshold.create({
        data: { ...t, adminId: admin.id, isActive: true },
      });
    }
  }
  console.log("  ✓ thresholds seeded (lower_bound + upper_bound)");

  // ── Demo patients ──
  const patients = [
    { name: "محمد علي حسن", phone: "01112223301", birthDate: "1985-04-12", smoking: "former" },
    { name: "فاطمة عبد الله", phone: "01112223302", birthDate: "1992-09-30", smoking: "never" },
    { name: "خالد إبراهيم", phone: "01112223303", birthDate: "1978-01-22", smoking: "current" },
    { name: "سارة محمود", phone: "01112223304", birthDate: "2000-06-15", smoking: "never" },
  ];

  for (const p of patients) {
    const token = uuidv4();
    const existing = await db.user.findUnique({ where: { phoneNumber: p.phone } });
    const user = existing ?? await db.user.create({
      data: {
        id: uuidv4(),
        name: p.name,
        phoneNumber: p.phone,
        passwordHash: bcrypt.hashSync("patient123", 10),
        role: "patient",
        patientToken: token,
        status: "active",
        profile: {
          create: {
            id: uuidv4(),
            birthDate: new Date(p.birthDate),
            smokingStatus: p.smoking,
            additionalInfo: "مريض متابعة دورية",
          },
        },
      },
      include: { profile: true },
    });

    // A couple of health records per patient (mix of normal + abnormal to show alerts).
    const records = [
      { bpS: 120, bpD: 80, hr: 72, notes: "قراءة طبيعية", attachments: [] },
      { bpS: 150, bpD: 95, hr: 88, notes: "ارتفاع بسيط في الضغط", attachments: [
        { type: "telegram", fileId: "demo-not-real", fileName: "ecg-reading.jpg", isImage: true }
      ]},
    ];
    for (const r of records) {
      await db.healthRecord.create({
        data: {
          id: uuidv4(),
          patientId: user.id,
          bpSystolic: r.bpS,
          bpDiastolic: r.bpD,
          heartRate: r.hr,
          notes: r.notes,
          attachments: JSON.stringify(r.attachments),
          createdAt: new Date(Date.now() - Math.random() * 86400000 * 3),
        },
      });
    }
    console.log("  ✓ patient:", user.name, user.phoneNumber);
  }

  console.log("✅ Seed complete.");
  console.log("   Admin login → phone: 01000000000  password: admin123");

  // ── Catalogs (demo data) ──
  const diseases = ["ارتفاع ضغط الدم", "السكري النوع الثاني", "أمراض القلب التاجية", "الربو"];
  for (const name of diseases) {
    const ex = await db.disease.findUnique({ where: { name } });
    if (!ex) await db.disease.create({ data: { id: uuidv4(), name, category: "عام" } });
  }
  const surgeries = ["قسطرة قلبية", "ترقيع صمام", "استئصال المرارة"];
  for (const name of surgeries) {
    const ex = await db.surgery.findUnique({ where: { name } });
    if (!ex) await db.surgery.create({ data: { id: uuidv4(), name, category: "قلب" } });
  }
  const symptoms = [
    { name: "ألم صدر", isCritical: true },
    { name: "ضيق تنفس", isCritical: true },
    { name: "دوخة", isCritical: false },
    { name: "إرهاق", isCritical: false },
  ];
  for (const s of symptoms) {
    const ex = await db.symptom.findUnique({ where: { name: s.name } });
    if (!ex) await db.symptom.create({ data: { id: uuidv4(), name: s.name, isCritical: s.isCritical } });
  }
  const meds = [
    { brandName: "Concor 5mg", genericName: "Bisoprolol", form: "tablet", category: "قلب" },
    { brandName: "Aspirin 75mg", genericName: "Acetylsalicylic Acid", form: "tablet", category: "قلب" },
    { brandName: "Glucophage 500mg", genericName: "Metformin", form: "tablet", category: "سكري" },
  ];
  for (const m of meds) {
    const ex = await db.medication.findFirst({ where: { brandName: m.brandName } });
    if (!ex) await db.medication.create({ data: { id: uuidv4(), ...m } });
  }
  const ctypes = [
    { name: "استشارة عاجلة", category: "immediate" },
    { name: "استشارة دورية", category: "regular" },
  ];
  for (const c of ctypes) {
    const ex = await db.consultationType.findFirst({ where: { name: c.name } });
    if (!ex) await db.consultationType.create({ data: { id: uuidv4(), ...c } });
  }

  // ── Demo consultations & appointments ──
  const patientUsers = await db.user.findMany({ where: { role: "patient" } });
  if (patientUsers.length >= 2) {
    const c1 = await db.consultation.findFirst({ where: { patientId: patientUsers[0].id } });
    if (!c1) {
      await db.consultation.create({
        data: {
          id: uuidv4(),
          patientId: patientUsers[0].id,
          category: "immediate",
          reason: "ألم في الصدر مع ضيق تنفس",
          status: "pending",
        },
      });
    }
    const c2 = await db.consultation.findFirst({ where: { patientId: patientUsers[1].id } });
    if (!c2) {
      await db.consultation.create({
        data: {
          id: uuidv4(),
          patientId: patientUsers[1].id,
          category: "regular",
          reason: "مراجعة نتائج التحاليل",
          status: "pending",
        },
      });
    }
    const a1 = await db.appointment.findFirst({ where: { patientId: patientUsers[2].id } });
    if (!a1) {
      await db.appointment.create({
        data: {
          id: uuidv4(),
          patientId: patientUsers[2].id,
          scheduledDate: new Date(Date.now() + 86400000 * 2),
          scheduledTime: "10:30",
          status: "requested",
          notes: "متابعة دورية",
        },
      });
    }
    const a2 = await db.appointment.findFirst({ where: { patientId: patientUsers[3].id } });
    if (!a2) {
      await db.appointment.create({
        data: {
          id: uuidv4(),
          patientId: patientUsers[3].id,
          scheduledDate: new Date(Date.now() + 86400000 * 3),
          scheduledTime: "12:00",
          status: "requested",
          notes: "استشارة جديدة",
        },
      });
    }
  }

  // ── Working hours (default: Sun-Thu active) ──
  for (let i = 0; i < 7; i++) {
    const ex = await db.workingHour.findUnique({ where: { dayOfWeek: i } });
    if (!ex) {
      await db.workingHour.create({
        data: { dayOfWeek: i, startTime: "09:00", endTime: "17:00", isActive: i < 5 },
      });
    }
  }

  console.log("  ✓ catalogs, consultations, appointments, working hours seeded");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
