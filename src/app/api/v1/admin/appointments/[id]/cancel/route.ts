import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/admin/appointments/[id]/cancel */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Appointment not found.");

  const updated = await db.appointment.update({ where: { id }, data: { status: "cancelled" } });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "APPOINTMENT_CANCEL",
    target: `appointment:${id}`,
    status: "success",
    meta: {
      appointment_id: id,
      patient_id: existing.patientId,
      scheduled_date: existing.scheduledDate,
      scheduled_time: existing.scheduledTime,
      previous_status: existing.status,
      new_status: "cancelled",
    },
  });

  return ok({ id: updated.id, status: updated.status }, "Appointment cancelled.");
}
