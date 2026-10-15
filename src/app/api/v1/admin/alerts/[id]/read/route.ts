import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/admin/alerts/[id]/read */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const existing = await db.alert.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Alert not found.");

  const updated = await db.alert.update({
    where: { id },
    data: { status: "read", readAt: new Date() },
  });
  return ok(
    { id: updated.id, status: updated.status, read_at: updated.readAt },
    "Alert marked as read."
  );
}
