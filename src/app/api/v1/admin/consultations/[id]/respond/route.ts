import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/v1/admin/consultations/[id]/respond
 *
 * Body: { response_text?, recommended_action?, follow_up_date? }
 *
 * Stores the doctor's response as a structured JSON object in the
 * `doctor_response` column so the Flutter app can render each piece in its
 * own UI slot (response text, recommended action, follow-up date). The legacy
 * `notes` column is also populated with a concatenated text version so the
 * admin's existing table view (which reads `notes`) keeps working.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const existing = await db.consultation.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Consultation not found.");

  const body = await req.json().catch(() => ({}));
  const responseText = (body.response_text || "").trim();
  const recommendedAction = body.recommended_action
    ? String(body.recommended_action).trim()
    : null;
  const followUpDate = body.follow_up_date
    ? String(body.follow_up_date).trim()
    : null;

  if (!responseText && !recommendedAction && !followUpDate) {
    return Err.badRequest(
      "VALIDATION_FAILED",
      "At least one of response_text, recommended_action, or follow_up_date is required."
    );
  }

  const doctorResponse = {
    response_text: responseText || null,
    recommended_action: recommendedAction,
    follow_up_date: followUpDate,
    responded_by: auth.user.id,
    responded_at: new Date().toISOString(),
  };

  // Concatenated legacy `notes` text — preserves the admin's existing display.
  const notesParts: string[] = [];
  if (responseText) notesParts.push(responseText);
  if (recommendedAction) notesParts.push(`الإجراء الموصى به: ${recommendedAction}`);
  if (followUpDate) notesParts.push(`موعد المتابعة: ${followUpDate}`);
  const legacyNotes = notesParts.join("\n");

  const updated = await db.consultation.update({
    where: { id },
    data: {
      status: "responded",
      respondedAt: new Date(),
      notes: legacyNotes || existing.notes,
      doctorResponse: JSON.stringify(doctorResponse),
    },
  });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "CONSULTATION_RESPOND",
    target: `consultation:${id}`,
    status: "success",
    meta: {
      consultation_id: id,
      patient_id: existing.patientId,
      previous_status: existing.status,
      new_status: "responded",
      response_text: responseText || null,
      recommended_action: recommendedAction,
      follow_up_date: followUpDate,
    },
  });

  return ok(
    {
      id: updated.id,
      status: updated.status,
      responded_at: updated.respondedAt,
      doctor_response: doctorResponse,
    },
    "Response sent."
  );
}
