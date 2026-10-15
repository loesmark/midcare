import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, paginate, pagination, Err } from "@/lib/api";
import { getTelegramConfig } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/patient/appointments
 * Body: { scheduled_date: "2025-01-20", scheduled_time: "14:30", notes?: string }
 *
 * يتحقق من ساعات عمل الطبيب. يُنشأ الموعد بحالة "requested".
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const body = await req.json().catch(() => ({}));
  const dateStr = body.scheduled_date;
  const timeStr = body.scheduled_time;
  if (!dateStr || !timeStr) {
    return Err.badRequest("VALIDATION_FAILED", "scheduled_date and scheduled_time are required.");
  }

  const scheduledDate = new Date(dateStr);
  if (isNaN(scheduledDate.getTime())) {
    return Err.badRequest("VALIDATION_FAILED", "Invalid scheduled_date.");
  }

  // Verify the doctor works on this day/time (optional — warn only)
  const dayOfWeek = scheduledDate.getDay();
  const wh = await db.workingHour.findUnique({ where: { dayOfWeek } });
  if (wh && wh.isActive) {
    if (timeStr < wh.startTime || timeStr > wh.endTime) {
      return Err.badRequest(
        "OUTSIDE_WORKING_HOURS",
        `Doctor is unavailable at this time. Working hours: ${wh.startTime} - ${wh.endTime}.`
      );
    }
  }

  // Verify the doctor is accepting appointments
  const tg = await getTelegramConfig();
  const settings = await db.setting.findMany();
  const availStatus = settings.find((s) => s.key === "doctor_availability_status")?.value || "active";
  if (availStatus === "off_today") {
    return Err.badRequest("DOCTOR_OFF_TODAY", "Doctor is off today. Please try another day.");
  }

  const appt = await db.appointment.create({
    data: {
      id: uuidv4(),
      patientId: auth.user.id,
      scheduledDate,
      scheduledTime: timeStr,
      status: "requested",
      notes: body.notes || null,
    },
  });

  return ok(
    {
      id: appt.id,
      scheduled_date: appt.scheduledDate,
      scheduled_time: appt.scheduledTime,
      status: appt.status,
      notes: appt.notes,
      created_at: appt.createdAt,
    },
    "Appointment requested. The doctor will confirm shortly."
  );
}

/** GET /api/v1/patient/appointments?page=&limit= — مواعيد المريض */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const { page, limit, skip } = pagination(req);
  const where = { patientId: auth.user.id };
  const [total, rows] = await Promise.all([
    db.appointment.count({ where }),
    db.appointment.findMany({
      where,
      orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
      skip,
      take: limit,
    }),
  ]);

  const data = rows.map((a) => ({
    id: a.id,
    scheduled_date: a.scheduledDate,
    scheduled_time: a.scheduledTime,
    status: a.status,
    notes: a.notes,
    whatsapp_link: a.whatsappLink,
    created_at: a.createdAt,
    confirmed_at: a.confirmedAt,
  }));

  return paginate(data, total, page, limit, "Your appointments.");
}
