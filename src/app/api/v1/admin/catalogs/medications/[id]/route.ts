import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = await db.medication.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Not found.");
  const body = await req.json().catch(() => ({}));
  const r = await db.medication.update({
    where: { id },
    data: {
      brandName: (body.brand_name || "").trim() || existing.brandName,
      genericName: body.generic_name ?? existing.genericName,
      form: body.form ?? existing.form,
      category: body.category ?? existing.category,
    },
  });

  const diff: Array<{ key: string; from: string; to: string }> = [];
  if (existing.brandName !== r.brandName) diff.push({ key: "brand_name", from: existing.brandName, to: r.brandName });
  if ((existing.genericName ?? null) !== (r.genericName ?? null)) diff.push({ key: "generic_name", from: String(existing.genericName ?? "∅"), to: String(r.genericName ?? "∅") });
  if ((existing.form ?? null) !== (r.form ?? null)) diff.push({ key: "form", from: String(existing.form ?? "∅"), to: String(r.form ?? "∅") });
  if ((existing.category ?? null) !== (r.category ?? null)) diff.push({ key: "category", from: String(existing.category ?? "∅"), to: String(r.category ?? "∅") });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "CATALOG_UPDATE",
    target: `medication:${id}`,
    status: "success",
    meta: { catalog: "medications", id, diff },
  });

  return ok({ id: r.id, brand_name: r.brandName, generic_name: r.genericName, form: r.form, category: r.category }, "Medication updated.");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = await db.medication.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Not found.");
  try {
    await db.medication.delete({ where: { id } });
    await logAudit({
      actorId: auth.user.id,
      req,
      action: "CATALOG_DELETE",
      target: `medication:${id}`,
      status: "success",
      meta: { catalog: "medications", id, brand_name: existing.brandName, generic_name: existing.genericName },
    });
    return ok({ id }, "Medication deleted.");
  } catch {
    return Err.notFound("NOT_FOUND", "Not found.");
  }
}
