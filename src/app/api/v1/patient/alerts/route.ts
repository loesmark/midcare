import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { paginate, pagination, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/patient/alerts?page=&limit=&status=
 *
 * تنبيهات المريض الخاصة (التي تولّدت من قراءاته). يستخدمها الموبايل
 * لعرض شارة التنبيهات في الواجهة.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const { page, limit, skip } = pagination(req);

  const where: any = { patientId: auth.user.id };
  if (status) where.status = status;

  const [total, alerts] = await Promise.all([
    db.alert.count({ where }),
    db.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const data = alerts.map((a) => ({
    id: a.id,
    parameter_name: a.parameterName,
    value: a.value,
    bound: a.bound,
    threshold_value: a.thresholdValue,
    severity: a.severity,
    status: a.status,
    created_at: a.createdAt,
  }));

  return paginate(data, total, page, limit, "Your alerts.");
}
