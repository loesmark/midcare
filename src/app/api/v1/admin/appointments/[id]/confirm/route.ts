import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { getTelegramConfig } from "@/lib/telegram";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/admin/appointments/[id]/confirm — sets status + generates WhatsApp link */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const appt = await db.appointment.findUnique({ where: { id }, include: { patient: true } });
  if (!appt) return Err.notFound("NOT_FOUND", "Appointment not found.");

  const tg = await getTelegramConfig();
  const phone = (tg.doctorWhatsapp || "").replace(/[^\d]/g, "");
  const dateStr = new Date(appt.scheduledDate).toLocaleDateString("en-GB");
  const text = encodeURIComponent(`مرحباً ${appt.patient.name}, تم تأكيد موعدك بتاريخ ${dateStr} الساعة ${appt.scheduledTime}.`);
  const waLink = phone ? `https://wa.me/${phone}?text=${text}` : null;

  const updated = await db.appointment.update({
    where: { id },
    data: { status: "confirmed", confirmedAt: new Date(), whatsappLink: waLink },
  });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "APPOINTMENT_CONFIRM",
    target: `appointment:${id}`,
    status: "success",
    meta: {
      appointment_id: id,
      patient_id: appt.patientId,
      patient_name: appt.patient.name,
      scheduled_date: appt.scheduledDate,
      scheduled_time: appt.scheduledTime,
      previous_status: appt.status,
      new_status: "confirmed",
    },
  });

  return ok(
    { id: updated.id, status: updated.status, whatsapp_link: updated.whatsappLink },
    "Appointment confirmed — WhatsApp link generated."
  );
}
