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
  const existing = await db.disease.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Not found.");
  const body = await req.json().catch(() => ({}));
  const r = await db.disease.update({
    where: { id },
    data: { name: (body.name || "").trim() || existing.name, category: body.category ?? existing.category },
  });

  // Build a diff for the audit log.
  const diff: Array<{ key: string; from: string; to: string }> = [];
  if (existing.name !== r.name) diff.push({ key: "name", from: existing.name, to: r.name });
  if ((existing.category ?? null) !== (r.category ?? null)) diff.push({ key: "category", from: String(existing.category ?? "∅"), to: String(r.category ?? "∅") });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "CATALOG_UPDATE",
    target: `disease:${id}`,
    status: "success",
    meta: { catalog: "diseases", id, diff },
  });

  return ok({ id: r.id, name: r.name, category: r.category }, "Disease updated.");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = await db.disease.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Not found.");
  try {
    await db.disease.delete({ where: { id } });
    await logAudit({
      actorId: auth.user.id,
      req,
      action: "CATALOG_DELETE",
      target: `disease:${id}`,
      status: "success",
      meta: { catalog: "diseases", id, name: existing.name, category: existing.category },
    });
    return ok({ id }, "Disease deleted.");
  } catch {
    return Err.notFound("NOT_FOUND", "Not found.");
  }
}
