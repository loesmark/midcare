import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok } from "@/lib/api";
import { getSettings } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/patient/working-hours
 *
 * Alias that returns the doctor's weekly working hours + availability status
 * in the shape the Flutter app expects:
 *   { working_hours: [...], availability_status: "active"|"off_today"|"after_hours_emergency" }
 *
 * The app's WorkingHoursInfo model handles BOTH a bare array and this wrapped
 * object shape — we return the wrapped shape so the availability_status is
 * explicit.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const [settings, hours] = await Promise.all([
    getSettings(),
    db.workingHour.findMany({ orderBy: { dayOfWeek: "asc" } }),
  ]);

  const status = settings.doctor_availability_status || "active";

  return ok(
    {
      working_hours: hours.map((h) => ({
        id: h.id,
        day_of_week: h.dayOfWeek,
        start_time: h.startTime,
        end_time: h.endTime,
        is_active: h.isActive,
      })),
      availability_status: status,
    },
    "Working hours."
  );
}
