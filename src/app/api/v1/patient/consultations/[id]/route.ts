import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/patient/consultations/[id] — single consultation */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const { id } = await params;
  const c = await db.consultation.findUnique({ where: { id } });
  if (!c) return Err.notFound("NOT_FOUND", "Consultation not found.");
  if (c.patientId !== auth.user.id) return Err.forbidden("AUTH_FORBIDDEN");

  return ok(
    {
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
    },
    "Consultation."
  );
}

function safeParseJson(s: string | null): any {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
