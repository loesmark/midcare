import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { paginate, pagination } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/consultations?page=&limit=&status= */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const { page, limit, skip } = pagination(req);
  const where = status ? { status } : {};

  const [total, rows] = await Promise.all([
    db.consultation.count({ where }),
    db.consultation.findMany({
      where,
      include: { patient: { select: { id: true, name: true, phoneNumber: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const data = rows.map((c) => ({
    id: c.id,
    patient_id: c.patientId,
    patient_name: c.patient?.name || "Unknown",
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

  return paginate(data, total, page, limit, "Consultations.");
}

function safeParseJson(s: string | null): any {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
