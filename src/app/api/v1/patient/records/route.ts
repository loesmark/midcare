import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, paginate, pagination, Err } from "@/lib/api";
import { evaluateReading } from "@/lib/alerts";
import { getTelegramConfig, uploadFileToTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/patient/records  (multipart: files[] + fields)
 *
 * Patient-app endpoint. Stores the reading + uploads files **exclusively to
 * Telegram** (the image group). No local filesystem storage is ever used —
 * this is a hard security/privacy requirement: patient files must never
 * touch the server's disk. If Telegram is not configured, file uploads are
 * rejected with a clear 400 error so the patient knows to retry later (the
 * reading itself is still saved, just without attachments).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const form = await req.formData();
  const bpS = num(form.get("bp_systolic"));
  const bpD = num(form.get("bp_diastolic"));
  const hr = num(form.get("heart_rate"));
  const notes = str(form.get("notes"));
  const currentMedications = str(form.get("current_medications"));
  const files = form.getAll("files").filter((f) => f instanceof File) as File[];

  if (bpS == null && bpD == null && hr == null) {
    return Err.badRequest("VALIDATION_FAILED", "At least one of bp_systolic, bp_diastolic, or heart_rate is required.");
  }

  // ── File attachments — Telegram ONLY (no local fallback) ──
  // If Telegram isn't configured and the patient attached files, reject the
  // WHOLE request with a clear message — the patient should retry once the
  // admin finishes setting up Telegram. We do NOT silently drop the files
  // (that would be data loss from the patient's perspective) and we do NOT
  // save them to disk (privacy requirement).
  const attachments: any[] = [];
  if (files.length > 0) {
    const tg = await getTelegramConfig();
    if (!tg.botToken || !tg.chatId) {
      return Err.badRequest(
        "TELEGRAM_NOT_CONFIGURED",
        "File storage is not yet configured on the server. Please remove the attached files and try again, or contact the clinic."
      );
    }
    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer());
      const r = await uploadFileToTelegram(tg.botToken, tg.chatId, buf, f.name);
      if (r.ok && r.fileId) {
        attachments.push({ type: "telegram", fileId: r.fileId, fileName: f.name, isImage: isImage(f.name) });
      } else {
        // Surface the Telegram error so the patient knows exactly what failed.
        return Err.badRequest(
          "TELEGRAM_UPLOAD_FAILED",
          `Failed to upload file "${f.name}" to storage: ${r.error || "unknown error"}. Please try again.`
        );
      }
    }
  }

  const record = await db.healthRecord.create({
    data: {
      id: uuidv4(),
      patientId: auth.user.id,
      bpSystolic: bpS,
      bpDiastolic: bpD,
      heartRate: hr,
      currentMedications,
      notes,
      attachments: JSON.stringify(attachments),
    },
  });

  const generated = await evaluateReading({
    patientId: auth.user.id,
    patientName: auth.user.name,
    healthRecordId: record.id,
    bpSystolic: bpS,
    bpDiastolic: bpD,
    heartRate: hr,
  });

  return ok(
    {
      record_id: record.id,
      files_uploaded: attachments.length,
      alerts_generated: generated.length,
      alerts: generated,
    },
    generated.length ? "Health record added — alert(s) generated." : "Health record added."
  );
}

/** GET /api/v1/patient/records?page=&limit= */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const { page, limit, skip } = pagination(req);
  const where = { patientId: auth.user.id };
  const [total, records] = await Promise.all([
    db.healthRecord.count({ where }),
    db.healthRecord.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);
  const data = records.map((r) => ({
    id: r.id,
    bp_systolic: r.bpSystolic,
    bp_diastolic: r.bpDiastolic,
    heart_rate: r.heartRate,
    current_medications: r.currentMedications,
    notes: r.notes,
    attachments: JSON.parse(r.attachments || "[]"),
    created_at: r.createdAt,
  }));
  return paginate(data, total, page, limit, "Patient health records.");
}

function num(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}
function str(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}
function isImage(name: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
}
