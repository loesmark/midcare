import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { paginate, pagination } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/logs?page=&limit=&status=&method=&search=
 * NOTE: these are audit-log-styled rows (we don't intercept every request in
 * this Next.js port). We surface audit_log rows as request logs so the
 * Technical → Request Logs view has data.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const statusClass = url.searchParams.get("status") || ""; // 2|3|4|5
  const method = url.searchParams.get("method") || "";
  const search = url.searchParams.get("search") || "";
  const { page, limit, skip } = pagination(req);

  const where: any = {};
  if (method) where.action = { contains: method };
  if (search) where.target = { contains: search };
  if (statusClass) {
    where.status = statusClass === "2" ? "success" : statusClass === "4" || statusClass === "5" ? "failure" : undefined;
  }

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    method: r.action?.split("_")[0] || "GET",
    path: r.target || "—",
    status: r.status === "success" ? 200 : 400,
    duration_ms: null,
    user_id: r.actorId,
    ip: r.actorIp,
    created_at: r.createdAt,
  }));

  return paginate(data, total, page, limit, "Request logs.");
}
