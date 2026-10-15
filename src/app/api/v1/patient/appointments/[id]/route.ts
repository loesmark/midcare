import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** DELETE /api/v1/patient/appointments/[id] — cancel an appointment */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const { id } = await params;
  const appt = await db.appointment.findUnique({ where: { id } });
  if (!appt) return Err.notFound("NOT_FOUND", "Appointment not found.");
  if (appt.patientId !== auth.user.id) return Err.forbidden("AUTH_FORBIDDEN");
  if (appt.status !== "requested") {
    return Err.badRequest("NOT_CANCELLABLE", "Only requested appointments can be cancelled.");
  }

  const updated = await db.appointment.update({ where: { id }, data: { status: "cancelled" } });
  return ok({ id: updated.id, status: updated.status }, "Appointment cancelled.");
}
