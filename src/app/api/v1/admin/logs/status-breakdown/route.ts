import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/logs/status-breakdown — counts by status class */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const rows = await db.auditLog.groupBy({ by: ["status"], _count: { _all: true } });
  const map: Record<string, number> = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  for (const r of rows) {
    if (r.status === "success") map["2xx"] += r._count._all;
    else map["4xx"] += r._count._all;
  }
  const data = Object.entries(map).map(([k, v]) => ({ status: k, count: v }));
  return ok(data, "HTTP status breakdown.");
}
