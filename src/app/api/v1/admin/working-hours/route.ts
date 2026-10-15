import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const DAY_NAMES = [
  "الأحد", "الإثنين", "الثلاثاء", "الأربعاء",
  "الخميس", "الجمعة", "السبت",
];

/** GET /api/v1/admin/working-hours — list all weekly slots */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const rows = await db.workingHour.findMany({ orderBy: { dayOfWeek: "asc" } });
  const data = rows.map((r) => ({
    id: r.id,
    day_of_week: r.dayOfWeek,
    day_name: DAY_NAMES[r.dayOfWeek] || "",
    start_time: r.startTime,
    end_time: r.endTime,
    is_active: r.isActive,
  }));
  return ok(data, "Working hours.");
}

/**
 * PUT /api/v1/admin/working-hours — upsert a day's slot.
 *
 * Body: { day_of_week, start_time, end_time, is_active }
 *
 * Audited: every working-hours change is logged with the before/after diff
 * and pushed to the alerts group so the clinic knows when the schedule was
 * modified (and by whom). This matters because changing working hours
 * affects whether patients can book appointments on that day.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const dow = Number(body.day_of_week);
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
    return Err.badRequest("VALIDATION_FAILED", "day_of_week must be 0-6.");
  }
  if (!body.start_time || !body.end_time) {
    return Err.badRequest("VALIDATION_FAILED", "start_time and end_time are required.");
  }

  // Snapshot the existing row for the diff.
  const existing = await db.workingHour.findUnique({ where: { dayOfWeek: dow } });
  const before = existing
    ? { start_time: existing.startTime, end_time: existing.endTime, is_active: existing.isActive }
    : null;

  const data = {
    dayOfWeek: dow,
    startTime: body.start_time,
    endTime: body.end_time,
    isActive: body.is_active !== undefined ? !!body.is_active : true,
  };
  let r;
  if (existing) {
    r = await db.workingHour.update({ where: { id: existing.id }, data });
  } else {
    r = await db.workingHour.create({ data });
  }

  // Build the diff for the audit log.
  const diff: Array<{ key: string; from: string; to: string }> = [];
  if (!before) {
    diff.push({ key: "created", from: "∅", to: DAY_NAMES[dow] });
  } else {
    if (before.start_time !== r.startTime) diff.push({ key: "start_time", from: before.start_time, to: r.startTime });
    if (before.end_time !== r.endTime) diff.push({ key: "end_time", from: before.end_time, to: r.endTime });
    if (before.is_active !== r.isActive) diff.push({ key: "is_active", from: String(before.is_active), to: String(r.isActive) });
  }

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "WORKING_HOURS_UPDATE",
    target: `day_${dow}_${DAY_NAMES[dow]}`,
    status: "success",
    meta: { day_of_week: dow, day_name: DAY_NAMES[dow], diff },
    notify: true, // clinic schedule changes are worth notifying
  });

  return ok(
    {
      id: r.id,
      day_of_week: r.dayOfWeek,
      day_name: DAY_NAMES[r.dayOfWeek] || "",
      start_time: r.startTime,
      end_time: r.endTime,
      is_active: r.isActive,
    },
    "Working hours saved."
  );
}
