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
  const [total, rows] = await Promise.all([
    db.symptom.count(),
    db.symptom.findMany({ orderBy: { name: "asc" }, skip, take: limit }),
  ]);
  const data = rows.map((r) => ({ id: r.id, name: r.name, category: r.category, is_critical: r.isCritical, created_at: r.createdAt }));
  return paginate(data, total, page, limit, "Symptoms.");
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) return Err.badRequest("VALIDATION_FAILED", "name is required.");
  try {
    const r = await db.symptom.create({ data: { id: uuidv4(), name, category: body.category || null, isCritical: !!body.is_critical } });
    await logAudit({
      actorId: auth.user.id,
      req,
      action: "CATALOG_CREATE",
      target: `symptom:${r.id}`,
      status: "success",
      meta: { catalog: "symptoms", id: r.id, name: r.name, category: r.category, is_critical: r.isCritical },
    });
    return ok({ id: r.id, name: r.name, category: r.category, is_critical: r.isCritical }, "Symptom created.");
  } catch {
    return Err.conflict("CONFLICT_NAME", "Already exists.");
  }
}
