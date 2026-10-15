import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { paginate, pagination } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/alerts?page=&limit=&status=&severity=&patient_id=
 *
 * Task 2 fix: returns alerts joined with the patient name + the bound that was
 * crossed, so the Alerts page is never empty when data exists. The previous
 * bug returned an empty list because the query didn't join the patient table
 * and the dashboard couldn't render a name → it showed nothing.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const severity = url.searchParams.get("severity") || undefined;
  const patientId = url.searchParams.get("patient_id") || undefined;
  const { page, limit, skip } = pagination(req);

  const where: any = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (patientId) where.patientId = patientId;

  const [total, alerts] = await Promise.all([
    db.alert.count({ where }),
    db.alert.findMany({
      where,
      include: { patient: { select: { id: true, name: true, phoneNumber: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const data = alerts.map((a) => ({
    id: a.id,
    patient_id: a.patientId,
    patient_name: a.patient?.name || "Unknown", // ← Task 2 & 7: name surfaced
    patient_phone: a.patient?.phoneNumber || null,
    health_record_id: a.healthRecordId,
    parameter_name: a.parameterName,
    value: a.value,
    bound: a.bound, // ← Task 3: which bound was crossed
    threshold_value: a.thresholdValue,
    severity: a.severity,
    status: a.status,
    telegram_sent: a.telegramSent,
    created_at: a.createdAt,
    read_at: a.readAt,
  }));

  return paginate(data, total, page, limit, "Alerts.");
}
