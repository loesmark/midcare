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
    db.medication.count(),
    db.medication.findMany({ orderBy: { brandName: "asc" }, skip, take: limit }),
  ]);
  const data = rows.map((r) => ({ id: r.id, brand_name: r.brandName, generic_name: r.genericName, form: r.form, category: r.category, created_at: r.createdAt }));
  return paginate(data, total, page, limit, "Medications.");
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const brandName = (body.brand_name || "").trim();
  if (!brandName) return Err.badRequest("VALIDATION_FAILED", "brand_name is required.");
  const r = await db.medication.create({
    data: { id: uuidv4(), brandName, genericName: body.generic_name || null, form: body.form || null, category: body.category || null },
  });
  await logAudit({
    actorId: auth.user.id,
    req,
    action: "CATALOG_CREATE",
    target: `medication:${r.id}`,
    status: "success",
    meta: { catalog: "medications", id: r.id, brand_name: r.brandName, generic_name: r.genericName, form: r.form, category: r.category },
  });
  return ok({ id: r.id, brand_name: r.brandName, generic_name: r.genericName, form: r.form, category: r.category }, "Medication created.");
}
