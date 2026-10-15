import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/v1/patient/alerts/[id]/read
 *
 * Marks an alert as `read` so the patient's home-screen badge reflects what
 * they've actually seen. Only the alert's owner can mark it.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const { id } = await params;
  const existing = await db.alert.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Alert not found.");
  if (existing.patientId !== auth.user.id) return Err.forbidden("AUTH_FORBIDDEN");

  // Only update if it's currently unread — avoids clobbering resolved alerts.
  if (existing.status === "unread") {
    const updated = await db.alert.update({
      where: { id },
      data: { status: "read", readAt: new Date() },
    });
    return ok(
      { id: updated.id, status: updated.status, read_at: updated.readAt },
      "Alert marked as read."
    );
  }

  return ok(
    { id: existing.id, status: existing.status, read_at: existing.readAt },
    "Alert already processed."
  );
}
