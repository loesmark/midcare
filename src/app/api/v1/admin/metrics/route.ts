import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/metrics — KPI snapshot */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const [totalUsers, patients, admins, activeUsers, suspendedUsers, alertsUnread, records, consultationsPending] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: "patient" } }),
      db.user.count({ where: { role: "admin" } }),
      db.user.count({ where: { status: "active" } }),
      db.user.count({ where: { status: "suspended" } }),
      db.alert.count({ where: { status: "unread" } }),
      db.healthRecord.count(),
      db.consultation.count({ where: { status: "pending" } }),
    ]);

  return ok(
    {
      users: { total: totalUsers, patients, admins, active: activeUsers, suspended: suspendedUsers },
      alerts: { unread: alertsUnread },
      records: { total: records },
      consultations: { pending: consultationsPending },
      server_time: new Date().toISOString(),
    },
    "Server metrics."
  );
}
