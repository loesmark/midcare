import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, paginate, pagination, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { page, limit, skip } = pagination(req);
  const where = {};
  const [total, rows] = await Promise.all([
    db.disease.count({ where }),
    db.disease.findMany({ where, orderBy: { name: "asc" }, skip, take: limit }),
  ]);
  const data = rows.map((r) => ({ id: r.id, name: r.name, category: r.category, created_at: r.createdAt }));
  return paginate(data, total, page, limit, "Diseases.");
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) return Err.badRequest("VALIDATION_FAILED", "name is required.");
  try {
    const r = await db.disease.create({ data: { id: uuidv4(), name, category: body.category || null } });
    await logAudit({
      actorId: auth.user.id,
      req,
      action: "CATALOG_CREATE",
      target: `disease:${r.id}`,
      status: "success",
      meta: { catalog: "diseases", id: r.id, name: r.name, category: r.category },
    });
    return ok({ id: r.id, name: r.name, category: r.category }, "Disease created.");
  } catch {
    return Err.conflict("CONFLICT_NAME", "A disease with this name already exists.");
  }
}
