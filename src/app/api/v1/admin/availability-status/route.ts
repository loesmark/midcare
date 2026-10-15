import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { getSettings, updateSettings } from "@/lib/telegram";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const VALID: Record<string, string> = {
  active: "الطبيب متاح",
  off_today: "الطبيب في عطلة اليوم",
  after_hours_emergency: "خارج ساعات العمل — طوارئ فقط",
};

/** GET /api/v1/admin/availability-status */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const s = await getSettings();
  const status = s.doctor_availability_status || "active";
  return ok({ status, label: VALID[status] || status }, "Availability status.");
}

/**
 * PUT /api/v1/admin/availability-status { status }
 *
 * Previously this route silently returned 200 "active" when given an invalid
 * status — that was a bug (caller couldn't tell if their update landed). Now
 * we return a 400 with a clear error message listing the valid values.
 *
 * Also audited: every availability flip is logged + pushed to Telegram so
 * the clinic team knows the doctor's status was changed (and by whom).
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const status = String(body.status || "");

  if (!VALID[status]) {
    // Audit the failed attempt too — repeated invalid tries are a signal.
    await logAudit({
      actorId: auth.user.id,
      req,
      action: "SETTINGS_AVAILABILITY",
      target: "doctor_availability_status",
      status: "failure",
      meta: { attempted: status, valid: Object.keys(VALID) },
      notify: false, // don't spam Telegram for user typos
    });
    return Err.badRequest(
      "VALIDATION_FAILED",
      `Invalid status. Must be one of: ${Object.keys(VALID).join(", ")}.`
    );
  }

  const before = await getSettings();
  const previous = before.doctor_availability_status || "active";

  await updateSettings({ doctor_availability_status: status });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "SETTINGS_AVAILABILITY",
    target: "doctor_availability_status",
    status: "success",
    meta: {
      diff: [{ key: "doctor_availability_status", from: previous, to: status }],
      previous,
      new: status,
    },
  });

  return ok(
    { status, label: VALID[status] },
    `Availability updated: ${previous} → ${status}.`
  );
}
