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
    db.consultationType.count(),
    db.consultationType.findMany({ orderBy: { name: "asc" }, skip, take: limit }),
  ]);
  const data = rows.map((r) => ({ id: r.id, name: r.name, category: r.category, created_at: r.createdAt }));
  return paginate(data, total, page, limit, "Consultation types.");
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const category = body.category || "regular";
  if (!name) return Err.badRequest("VALIDATION_FAILED", "name is required.");
  if (!["immediate", "regular"].includes(category)) return Err.badRequest("VALIDATION_FAILED", "category must be immediate or regular.");
  const r = await db.consultationType.create({ data: { id: uuidv4(), name, category } });
  await logAudit({
    actorId: auth.user.id,
    req,
    action: "CATALOG_CREATE",
    target: `consultation_type:${r.id}`,
    status: "success",
    meta: { catalog: "consultation_types", id: r.id, name: r.name, category: r.category },
  });
  return ok({ id: r.id, name: r.name, category: r.category }, "Consultation type created.");
}
