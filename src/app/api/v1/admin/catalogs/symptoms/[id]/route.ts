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
  const existing = await db.symptom.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Not found.");
  const body = await req.json().catch(() => ({}));
  const r = await db.symptom.update({
    where: { id },
    data: {
      name: (body.name || "").trim() || existing.name,
      category: body.category ?? existing.category,
      isCritical: body.is_critical !== undefined ? !!body.is_critical : existing.isCritical,
    },
  });

  const diff: Array<{ key: string; from: string; to: string }> = [];
  if (existing.name !== r.name) diff.push({ key: "name", from: existing.name, to: r.name });
  if ((existing.category ?? null) !== (r.category ?? null)) diff.push({ key: "category", from: String(existing.category ?? "∅"), to: String(r.category ?? "∅") });
  if (existing.isCritical !== r.isCritical) diff.push({ key: "is_critical", from: String(existing.isCritical), to: String(r.isCritical) });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "CATALOG_UPDATE",
    target: `symptom:${id}`,
    status: "success",
    meta: { catalog: "symptoms", id, diff },
  });

  return ok({ id: r.id, name: r.name, category: r.category, is_critical: r.isCritical }, "Symptom updated.");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = await db.symptom.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Not found.");
  try {
    await db.symptom.delete({ where: { id } });
    await logAudit({
      actorId: auth.user.id,
      req,
      action: "CATALOG_DELETE",
      target: `symptom:${id}`,
      status: "success",
      meta: { catalog: "symptoms", id, name: existing.name, category: existing.category, is_critical: existing.isCritical },
    });
    return ok({ id }, "Symptom deleted.");
  } catch {
    return Err.notFound("NOT_FOUND", "Not found.");
  }
}
