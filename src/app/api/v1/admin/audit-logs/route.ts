import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { paginate, pagination } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/audit-logs?page=&limit=&action= */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || undefined;
  const { page, limit, skip } = pagination(req);
  const where = action ? { action: { contains: action } } : {};

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    actor_id: r.actorId,
    actor_ip: r.actorIp,
    action: r.action,
    target: r.target,
    status: r.status,
    meta: r.meta,
    created_at: r.createdAt,
  }));

  return paginate(data, total, page, limit, "Audit logs.");
}
