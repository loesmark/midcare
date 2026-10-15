import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/patient/profile — بيانات المريض + ملفه + selections */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const user = await db.user.findUnique({
    where: { id: auth.user.id },
    include: {
      profile: {
        include: {
          diseases: { include: { disease: true } },
          surgeries: { include: { surgery: true } },
          medications: { include: { medication: true } },
        },
      },
    },
  });
  if (!user) return Err.notFound("NOT_FOUND", "User not found.");

  const profile = user.profile;
  return ok(
    {
      id: user.id,
      name: user.name,
      phone_number: user.phoneNumber,
      role: user.role,
      status: user.status,
      birth_date: profile?.birthDate || null,
      smoking_status: profile?.smokingStatus || null,
      additional_info: profile?.additionalInfo || null,
      is_completed: !!(profile?.birthDate && profile?.smokingStatus),
      selections: {
        diseases: (profile?.diseases || []).map((d) => ({
          id: d.id,
          disease_id: d.diseaseId,
          disease_name: d.disease?.name || null,
          custom_name: d.customName,
        })),
        surgeries: (profile?.surgeries || []).map((s) => ({
          id: s.id,
          surgery_id: s.surgeryId,
          surgery_name: s.surgery?.name || null,
          custom_name: s.customName,
        })),
        medications: (profile?.medications || []).map((m) => ({
          id: m.id,
          medication_id: m.medicationId,
          brand_name: m.medication?.brandName || null,
          generic_name: m.medication?.genericName || null,
          custom_name: m.customName,
          dose: m.dose,
          frequency: m.frequency,
          schedule_times: JSON.parse(m.scheduleTimes || "[]"),
          instructions: m.instructions,
          status: m.status,
        })),
      },
    },
    "Patient profile."
  );
}

/**
 * PUT /api/v1/patient/profile
 * Body: {
 *   birth_date?, smoking_status?, additional_info?,
 *   diseases?: [{disease_id?|custom_name?}],
 *   surgeries?: [{surgery_id?|custom_name?}],
 *   medications?: [{medication_id?|custom_name?, dose?, frequency?, schedule_times?, instructions?}]
 * }
 *
 * Replaces the patient's disease/surgery/medication selections atomically
 * (deletes existing rows then re-creates from the payload) so the Flutter
 * app can send the full list on every save.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const body = await req.json().catch(() => ({}));

  // Ensure a profile row exists, then update basic fields.
  const existing = await db.patientProfile.findUnique({ where: { userId: auth.user.id } });
  const data = {
    birthDate: body.birth_date ? new Date(body.birth_date) : existing?.birthDate,
    smokingStatus: body.smoking_status ?? existing?.smokingStatus,
    additionalInfo: body.additional_info ?? existing?.additionalInfo,
  };
  const profile = existing
    ? await db.patientProfile.update({ where: { userId: auth.user.id }, data })
    : await db.patientProfile.create({ data: { id: uuidv4(), userId: auth.user.id, ...data } });

  // Replace selections (diseases / surgeries / medications) when provided.
  if (Array.isArray(body.diseases)) {
    await db.patientDisease.deleteMany({ where: { profileId: profile.id } });
    for (const d of body.diseases) {
      await db.patientDisease.create({
        data: {
          id: uuidv4(),
          profileId: profile.id,
          diseaseId: d.disease_id || null,
          customName: d.custom_name || null,
        },
      });
    }
  }
  if (Array.isArray(body.surgeries)) {
    await db.patientSurgery.deleteMany({ where: { profileId: profile.id } });
    for (const s of body.surgeries) {
      await db.patientSurgery.create({
        data: {
          id: uuidv4(),
          profileId: profile.id,
          surgeryId: s.surgery_id || null,
          customName: s.custom_name || null,
        },
      });
    }
  }
  if (Array.isArray(body.medications)) {
    await db.patientMedication.deleteMany({ where: { profileId: profile.id } });
    for (const m of body.medications) {
      await db.patientMedication.create({
        data: {
          id: uuidv4(),
          profileId: profile.id,
          medicationId: m.medication_id || null,
          customName: m.custom_name || null,
          dose: m.dose || null,
          frequency: m.frequency || null,
          scheduleTimes: JSON.stringify(m.schedule_times || []),
          instructions: m.instructions || null,
          status: m.status || "active",
        },
      });
    }
  }

  // Re-fetch with selections so the response matches GET.
  const refreshed = await db.patientProfile.findUnique({
    where: { id: profile.id },
    include: {
      diseases: { include: { disease: true } },
      surgeries: { include: { surgery: true } },
      medications: { include: { medication: true } },
    },
  });

  return ok(
    {
      id: auth.user.id,
      birth_date: refreshed?.birthDate || null,
      smoking_status: refreshed?.smokingStatus || null,
      additional_info: refreshed?.additionalInfo || null,
      is_completed: !!(refreshed?.birthDate && refreshed?.smokingStatus),
      selections: {
        diseases: (refreshed?.diseases || []).map((d) => ({
          id: d.id,
          disease_id: d.diseaseId,
          disease_name: d.disease?.name || null,
          custom_name: d.customName,
        })),
        surgeries: (refreshed?.surgeries || []).map((s) => ({
          id: s.id,
          surgery_id: s.surgeryId,
          surgery_name: s.surgery?.name || null,
          custom_name: s.customName,
        })),
        medications: (refreshed?.medications || []).map((m) => ({
          id: m.id,
          medication_id: m.medicationId,
          brand_name: m.medication?.brandName || null,
          generic_name: m.medication?.genericName || null,
          custom_name: m.customName,
          dose: m.dose,
          frequency: m.frequency,
          schedule_times: JSON.parse(m.scheduleTimes || "[]"),
          instructions: m.instructions,
          status: m.status,
        })),
      },
    },
    "Profile updated."
  );
}
