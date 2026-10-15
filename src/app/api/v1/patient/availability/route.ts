import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok } from "@/lib/api";
import { getSettings } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/patient/availability
 *
 * يعيد حالة الطبيب + ساعات العمل الأسبوعية. يستخدمها الموبايل لعرض
 * "الطبيب متاح الآن" ولتحديد الأوقات المتاحة لطلب موعد.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const [settings, hours] = await Promise.all([
    getSettings(),
    db.workingHour.findMany({ orderBy: { dayOfWeek: "asc" } }),
  ]);

  const status = settings.doctor_availability_status || "active";
  const now = new Date();
  const today = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

  const todayHours = hours.find((h) => h.dayOfWeek === today);
  const isAvailableNow =
    status === "active" &&
    !!todayHours?.isActive &&
    currentTime >= todayHours.startTime &&
    currentTime <= todayHours.endTime;

  return ok(
    {
      status, // active | off_today | after_hours_emergency
      is_available_now: isAvailableNow,
      today_hours: todayHours
        ? { start: todayHours.startTime, end: todayHours.endTime, is_active: todayHours.isActive }
        : null,
      weekly_hours: hours.map((h) => ({
        day_of_week: h.dayOfWeek,
        start_time: h.startTime,
        end_time: h.endTime,
        is_active: h.isActive,
      })),
    },
    "Doctor availability."
  );
}
