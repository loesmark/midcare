import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, paginate, pagination, Err } from "@/lib/api";
import { getTelegramConfig, uploadFileToTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/patient/documents  (multipart)
 *   fields: type (ecg|echo|lab|other), title, notes, taken_at?
 *   files:  files[]
 *
 * يرفع المستندات الطبية (تخطيط قلب، إيكو، تحاليل). الملفات تُرسل حصراً لمجموعة
 * تيليجرام (يجب تهيئتها مسبقاً) ويُخزّن file_id — لا يُسمح بأي تخزين محلي
 * على قرص الخادم (متطلب خصوصية).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const form = await req.formData();
  const type = (form.get("type") as string) || "other";
  const title = (form.get("title") as string) || null;
  const notes = (form.get("notes") as string) || null;
  const takenAt = form.get("taken_at") ? new Date(form.get("taken_at") as string) : null;
  const files = form.getAll("files").filter((f) => f instanceof File) as File[];

  if (!files.length) {
    return Err.badRequest("VALIDATION_FAILED", "At least one file is required.");
  }

  const validTypes = ["ecg", "echo", "lab", "other"];
  const docType = validTypes.includes(type) ? type : "other";

  // Upload files — Telegram ONLY (no local filesystem fallback).
  // Privacy requirement: patient documents must never touch the server disk.
  const attachments: any[] = [];
  const tg = await getTelegramConfig();
  if (!tg.botToken || !tg.chatId) {
    return Err.badRequest(
      "TELEGRAM_NOT_CONFIGURED",
      "File storage is not yet configured on the server. Please contact the clinic before uploading documents."
    );
  }
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const r = await uploadFileToTelegram(tg.botToken, tg.chatId, buf, f.name, `Document from ${auth.user.name}`);
    if (r.ok && r.fileId) {
      attachments.push({ type: "telegram", fileId: r.fileId, fileName: f.name, isImage: isImage(f.name) });
    } else {
      return Err.badRequest(
        "TELEGRAM_UPLOAD_FAILED",
        `Failed to upload file "${f.name}" to storage: ${r.error || "unknown error"}. Please try again.`
      );
    }
  }

  const doc = await db.patientDocument.create({
    data: {
      id: uuidv4(),
      patientId: auth.user.id,
      type: docType,
      title,
      notes,
      attachments: JSON.stringify(attachments),
    },
  });

  return ok(
    {
      id: doc.id,
      type: doc.type,
      title: doc.title,
      notes: doc.notes,
      attachments,
      created_at: doc.createdAt,
    },
    "Document uploaded."
  );
}

/** GET /api/v1/patient/documents?page=&limit= — مستندات المريض */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const { page, limit, skip } = pagination(req);
  const where = { patientId: auth.user.id };
  const [total, rows] = await Promise.all([
    db.patientDocument.count({ where }),
    db.patientDocument.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);

  const data = rows.map((d) => ({
    id: d.id,
    type: d.type,
    title: d.title,
    notes: d.notes,
    attachments: JSON.parse(d.attachments || "[]"),
    created_at: d.createdAt,
  }));

  return paginate(data, total, page, limit, "Your documents.");
}

function isImage(name: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
}
