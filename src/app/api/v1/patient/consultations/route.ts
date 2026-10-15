import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, paginate, pagination, Err } from "@/lib/api";
import { getTelegramConfig, uploadFileToTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/patient/consultations
 *
 * Body (JSON or multipart):
 *   category:             "immediate" | "regular"  (default "regular")
 *   type_id?:             string  (selected from /catalogs/consultation_types)
 *   custom_type?:         string  (when the patient types a custom type)
 *   reason:               string  (required — the patient's complaint text)
 *   symptoms?:            array   [{name, is_critical}] OR JSON-encoded string
 *   custom_symptom_text?: string  (free-text symptom description)
 *   attachment?:          File    (multipart only — sent under field name "attachment")
 *
 * The backend auto-builds a `context` JSON with the patient's latest reading +
 * freshness so the doctor sees the most recent vitals without leaving the
 * consultations screen. For `immediate` consultations we also build a WhatsApp
 * deeplink to the doctor's number.
 *
 * On multipart requests the optional attachment is uploaded to Telegram (when
 * configured) — strictly Telegram only, no local filesystem fallback. The
 * stored file refs are attached to the `context` so the doctor can preview
 * them.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  // ── Parse body — supports JSON (recommended) or multipart ──
  let body: any = {};
  let attachment: File | null = null;
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const [k, v] of form.entries()) {
      if (k === "attachment" && v instanceof File) {
        attachment = v;
      } else {
        body[k] = typeof v === "string" ? v : v;
      }
    }
  } else {
    body = await req.json().catch(() => ({}));
  }

  const category = body.category === "immediate" ? "immediate" : "regular";
  const reason = (body.reason || "").trim();
  if (!reason) return Err.badRequest("VALIDATION_FAILED", "reason is required.");

  // Optional consultation type. The patient either picks a catalog id or
  // types a custom label. At least one is required.
  const typeId = body.type_id ? String(body.type_id).trim() || null : null;
  const customType =
    typeof body.custom_type === "string" && body.custom_type.trim()
      ? body.custom_type.trim()
      : null;
  if (!typeId && !customType) {
    return Err.badRequest(
      "VALIDATION_FAILED",
      "type_id or custom_type is required."
    );
  }

  // Symptoms: accept either a JSON-encoded string or a parsed array.
  let symptomsJson = "[]";
  if (typeof body.symptoms === "string" && body.symptoms.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(body.symptoms);
      if (Array.isArray(parsed)) symptomsJson = body.symptoms;
    } catch {
      /* keep default [] */
    }
  } else if (Array.isArray(body.symptoms)) {
    symptomsJson = JSON.stringify(body.symptoms);
  }

  const customSymptomText =
    typeof body.custom_symptom_text === "string" && body.custom_symptom_text.trim()
      ? body.custom_symptom_text.trim()
      : null;

  // ── Build the auto-context: latest reading + freshness + attachments ──
  const context = await buildConsultationContext(auth.user.id);

  // ── Upload attachment (if any) — Telegram ONLY ──
  // Privacy requirement: patient files must never touch the server disk.
  // If Telegram isn't configured, the attachment is rejected with a clear
  // error; the patient can retry without the attachment.
  if (attachment) {
    const tg = await getTelegramConfig();
    if (!tg.botToken || !tg.chatId) {
      return Err.badRequest(
        "TELEGRAM_NOT_CONFIGURED",
        "File storage is not yet configured on the server. Please remove the attachment and try again, or contact the clinic."
      );
    }
    const buf = Buffer.from(await attachment.arrayBuffer());
    const r = await uploadFileToTelegram(
      tg.botToken,
      tg.chatId,
      buf,
      attachment.name,
      `استشارة من ${auth.user.name}`
    );
    if (!r.ok || !r.fileId) {
      return Err.badRequest(
        "TELEGRAM_UPLOAD_FAILED",
        `Failed to upload attachment "${attachment.name}": ${r.error || "unknown error"}. Please try again.`
      );
    }
    context.attachments = [
      {
        type: "telegram",
        fileId: r.fileId,
        fileName: attachment.name,
        isImage: isImage(attachment.name),
      },
    ];
  }

  // ── For immediate consultations, generate a WhatsApp link to the doctor ──
  let whatsappLink: string | null = null;
  if (category === "immediate") {
    const tg = await getTelegramConfig();
    const phone = (tg.doctorWhatsapp || "").replace(/[^\d]/g, "");
    if (phone) {
      const text = encodeURIComponent(
        `مرحباً دكتور، أحتاج استشارة عاجلة.\n${auth.user.name}: ${reason}`
      );
      whatsappLink = `https://wa.me/${phone}?text=${text}`;
    }
  }

  const consultation = await db.consultation.create({
    data: {
      id: uuidv4(),
      patientId: auth.user.id,
      category,
      typeId,
      customType,
      reason,
      symptoms: symptomsJson,
      customSymptomText,
      context: JSON.stringify(context),
      status: "pending",
      whatsappLink,
    },
  });

  return ok(
    {
      id: consultation.id,
      consultation_id: consultation.id, // back-compat for the Flutter client
      category: consultation.category,
      type_id: consultation.typeId,
      custom_type: consultation.customType,
      reason: consultation.reason,
      symptoms: JSON.parse(consultation.symptoms || "[]"),
      custom_symptom_text: consultation.customSymptomText,
      context,
      status: consultation.status,
      whatsapp_link: consultation.whatsappLink,
      created_at: consultation.createdAt,
    },
    category === "immediate"
      ? "Consultation requested. Open WhatsApp to reach the doctor immediately."
      : "Consultation requested. The doctor will respond shortly."
  );
}

/** GET /api/v1/patient/consultations?page=&limit= — سجل استشارات المريض */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const { page, limit, skip } = pagination(req);
  const where = { patientId: auth.user.id };
  const [total, rows] = await Promise.all([
    db.consultation.count({ where }),
    db.consultation.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);

  const data = rows.map((c) => ({
    id: c.id,
    category: c.category,
    type_id: c.typeId,
    custom_type: c.customType,
    reason: c.reason,
    symptoms: JSON.parse(c.symptoms || "[]"),
    custom_symptom_text: c.customSymptomText,
    context: safeParseJson(c.context),
    status: c.status,
    notes: c.notes,
    doctor_response: safeParseJson(c.doctorResponse),
    whatsapp_link: c.whatsappLink,
    created_at: c.createdAt,
    responded_at: c.respondedAt,
  }));

  return paginate(data, total, page, limit, "Your consultations.");
}

// ── helpers ──

async function buildConsultationContext(patientId: string) {
  const latest = await db.healthRecord.findFirst({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });
  let freshness: "fresh" | "old" | "none" = "none";
  if (latest) {
    const ageMs = Date.now() - latest.createdAt.getTime();
    freshness = ageMs <= 24 * 3600 * 1000 ? "fresh" : "old";
  }
  return {
    latest_reading: latest
      ? {
          id: latest.id,
          bp_systolic: latest.bpSystolic,
          bp_diastolic: latest.bpDiastolic,
          heart_rate: latest.heartRate,
          notes: latest.notes,
          created_at: latest.createdAt,
        }
      : null,
    reading_freshness: freshness,
    attachments: [] as any[],
  };
}

function safeParseJson(s: string | null): any {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function isImage(name: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
}
