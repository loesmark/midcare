import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/logs/top-endpoints — top paths by hits */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const rows = await db.auditLog.groupBy({
    by: ["target"],
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
  const data = rows
    .filter((r) => r.target)
    .map((r) => ({ path: r.target, hits: r._count._all }));
  return ok(data, "Top endpoints.");
}
