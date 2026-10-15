import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { paginate, pagination, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/appointments
 *
 * Query params:
 *   page, limit                 — pagination
 *   status                      — requested|confirmed|cancelled|completed
 *   range                       — today|week|month  (date-range filter)
 *
 * The response includes `patient_phone` (in addition to `patient_name`) so
 * the admin can call/message the patient directly from the table. When the
 * patient's phone lacks a country code, the admin UI uses the
 * `patient_phone` value as a fallback `tel:` link.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const range = url.searchParams.get("range") || undefined; // today | week | month

  // ── Build the date-range filter ──
  // We compute [startOfRange, endOfRange] in UTC to match SQLite's stored
  // scheduledDate (which Prisma serializes as ISO UTC).
  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;
  if (range === "today") {
    const now = new Date();
    rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    rangeEnd = new Date(rangeStart);
    rangeEnd.setUTCDate(rangeStart.getUTCDate() + 1);
  } else if (range === "week") {
    // Last 7 days including today.
    const now = new Date();
    rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 6); // 7-day window ending today
    rangeEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
  } else if (range === "month") {
    // Current calendar month (UTC).
    const now = new Date();
    rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    rangeEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  } else if (range && range !== "all") {
    // Reject unknown range values explicitly (instead of silently ignoring).
    return Err.badRequest("VALIDATION_FAILED", `range must be one of: today, week, month, all — got "${range}".`);
  }

  // Build the where clause.
  const where: any = {};
  if (status) where.status = status;
  if (rangeStart && rangeEnd) {
    where.scheduledDate = { gte: rangeStart, lt: rangeEnd };
  }

  const { page, limit, skip } = pagination(req);

  const [total, rows] = await Promise.all([
    db.appointment.count({ where }),
    db.appointment.findMany({
      where,
      include: { patient: { select: { id: true, name: true, phoneNumber: true } } },
      orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
      skip,
      take: limit,
    }),
  ]);

  const data = rows.map((a) => ({
    id: a.id,
    patient_id: a.patientId,
    patient_name: a.patient?.name || "Unknown",
    patient_phone: a.patient?.phoneNumber || null, // ← exposed for the admin UI's "تواصل" button
    scheduled_date: a.scheduledDate,
    scheduled_time: a.scheduledTime,
    status: a.status,
    notes: a.notes,
    whatsapp_link: a.whatsappLink,
    created_at: a.createdAt,
    confirmed_at: a.confirmedAt,
  }));

  return paginate(data, total, page, limit, "Appointments.");
}
