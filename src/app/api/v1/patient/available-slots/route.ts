import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/patient/available-slots?date=YYYY-MM-DD
 *
 * Computes the available 30-minute slots for the given date:
 *   - Reads the doctor's working hours for that day-of-week.
 *   - If the day is inactive → returns an empty slots array.
 *   - Generates 30-minute slots between start_time and end_time.
 *   - Marks slots as unavailable if an existing appointment already covers
 *     them (status != cancelled).
 *
 * Returns the shape the Flutter app expects:
 *   { date, day_of_week, slots: [{ start, end, available }] }
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  if (!dateStr) {
    return ok({ date: "", day_of_week: -1, slots: [] }, "No date provided.");
  }

  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date.getTime())) {
    return ok({ date: dateStr, day_of_week: -1, slots: [] }, "Invalid date.");
  }

  // 0=Sun..6=Sat — matches our WorkingHour.dayOfWeek
  const dayOfWeek = date.getDay();

  const wh = await db.workingHour.findUnique({ where: { dayOfWeek } });
  if (!wh || !wh.isActive) {
    return ok(
      { date: dateStr, day_of_week: dayOfWeek, slots: [] },
      "No working hours for this day."
    );
  }

  // Generate 30-minute slots between start_time and end_time.
  const slots = generateSlots(wh.startTime, wh.endTime);

  // Mark booked slots as unavailable.
  const dayStart = new Date(date);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const appointments = await db.appointment.findMany({
    where: {
      scheduledDate: { gte: dayStart, lte: dayEnd },
      status: { not: "cancelled" },
    },
    select: { scheduledTime: true },
  });
  const bookedTimes = new Set(appointments.map((a) => a.scheduledTime));

  const slotsWithAvailability = slots.map((s) => ({
    start: s.start,
    end: s.end,
    available: !bookedTimes.has(s.start),
  }));

  return ok(
    {
      date: dateStr,
      day_of_week: dayOfWeek,
      slots: slotsWithAvailability,
    },
    "Available slots."
  );
}

/** Generates 30-minute slots between start and end (HH:MM format). */
function generateSlots(start: string, end: string): { start: string; end: string }[] {
  const toMin = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const toHHMM = (min: number): string => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const startMin = toMin(start);
  const endMin = toMin(end);
  const result: { start: string; end: string }[] = [];
  for (let t = startMin; t + 30 <= endMin; t += 30) {
    result.push({ start: toHHMM(t), end: toHHMM(t + 30) });
  }
  return result;
}
