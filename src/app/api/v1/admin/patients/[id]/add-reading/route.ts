import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { evaluateReading } from "@/lib/alerts";
import { getTelegramConfig, uploadFileToTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/admin/patients/[id]/add-reading
 *
 * Admin-side helper to record a reading on behalf of a patient (mimics what
 * the Flutter patient app does via POST /api/v1/patient/records). Used to
 * demonstrate the alert-generation pipeline (Tasks 3, 4, 6) from the admin
 * dashboard without needing the mobile app.
 *
 * Accepts multipart/form-data:
 *   bp_systolic, bp_diastolic, heart_rate, notes, files[]
 * Files are uploaded to the Telegram image group (when configured) and their
 * file_ids are stored as attachments. When Telegram is not configured, files
 * are saved locally under /uploads and referenced by a local URL so the
 * thumbnails + lightbox (Task 8) work out of the box.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const patient = await db.user.findUnique({ where: { id } });
  if (!patient || patient.role !== "patient") {
    return Err.notFound("NOT_FOUND", "Patient not found.");
  }

  const form = await req.formData();
  const bpS = num(form.get("bp_systolic"));
  const bpD = num(form.get("bp_diastolic"));
  const hr = num(form.get("heart_rate"));
  const notes = str(form.get("notes"));
  const files = form.getAll("files").filter((f) => f instanceof File) as File[];

  if (bpS == null && bpD == null && hr == null) {
    return Err.badRequest("VALIDATION_FAILED", "At least one of bp_systolic, bp_diastolic, or heart_rate is required.");
  }

  // ── Handle file attachments — Telegram ONLY (no local fallback) ──
  // Privacy requirement: patient files must never touch the server disk,
  // even when the doctor is the one uploading on the patient's behalf.
  const attachments: any[] = [];
  if (files.length > 0) {
    const tg = await getTelegramConfig();
    if (!tg.botToken || !tg.chatId) {
      return Err.badRequest(
        "TELEGRAM_NOT_CONFIGURED",
        "File storage (Telegram) is not configured. Open Settings → Telegram & WhatsApp, save the Bot Token + image group chat ID, then try again."
      );
    }
    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer());
      const r = await uploadFileToTelegram(tg.botToken, tg.chatId, buf, f.name, `قراءة من ${patient.name}`);
      if (r.ok && r.fileId) {
        attachments.push({ type: "telegram", fileId: r.fileId, fileName: f.name, isImage: isImage(f.name) });
      } else {
        return Err.badRequest(
          "TELEGRAM_UPLOAD_FAILED",
          `Failed to upload file "${f.name}": ${r.error || "unknown error"}.`
        );
      }
    }
  }

  // ── Create the health record ──
  const record = await db.healthRecord.create({
    data: {
      id: uuidv4(),
      patientId: patient.id,
      bpSystolic: bpS,
      bpDiastolic: bpD,
      heartRate: hr,
      notes,
      attachments: JSON.stringify(attachments),
    },
  });

  // ── Tasks 3, 4, 6: evaluate thresholds → dedup → telegram alerts group ──
  const generated = await evaluateReading({
    patientId: patient.id,
    patientName: patient.name,
    healthRecordId: record.id,
    bpSystolic: bpS,
    bpDiastolic: bpD,
    heartRate: hr,
  });

  return ok(
    {
      record: {
        id: record.id,
        bp_systolic: record.bpSystolic,
        bp_diastolic: record.bpDiastolic,
        heart_rate: record.heartRate,
        notes: record.notes,
        attachments,
        created_at: record.createdAt,
      },
      alerts_generated: generated,
      alerts_count: generated.length,
    },
    generated.length
      ? `Reading saved — ${generated.length} alert(s) generated and pushed to the alerts group.`
      : "Reading saved — values within range, or an unread alert already exists for this parameter (no duplicate created)."
  );
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
