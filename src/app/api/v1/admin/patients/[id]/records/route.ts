import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, paginate, pagination, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/patients/[id]/records?page=&limit=
 *
 * Task 8: returns records with their `attachments` parsed, so the admin panel
 * can render image thumbnails + open a lightbox. Each attachment has:
 *   { type: 'local'|'telegram', url?, fileId?, fileName, isImage }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, include: { profile: true } });
  if (!user) return Err.notFound("NOT_FOUND", "Patient not found.");

  const { page, limit, skip } = pagination(req);
  const where = { patientId: id };
  const [total, records] = await Promise.all([
    db.healthRecord.count({ where }),
    db.healthRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const data = records.map((r) => ({
    id: r.id,
    patient_id: r.patientId,
    bp_systolic: r.bpSystolic,
    bp_diastolic: r.bpDiastolic,
    heart_rate: r.heartRate,
    current_medications: r.currentMedications,
    notes: r.notes,
    attachments: safeParseAttachments(r.attachments),
    created_at: r.createdAt,
  }));

  return paginate(data, total, page, limit, "Patient records.");
}

function safeParseAttachments(raw: string): any[] {
  try {
    const a = JSON.parse(raw || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}
