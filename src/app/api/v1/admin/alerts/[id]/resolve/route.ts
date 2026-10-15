import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/admin/alerts/[id]/resolve */
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
    data: {
      status: "resolved",
      // Keep the original `readAt` if already set, otherwise stamp it now
      // (a resolved alert is implicitly also read).
      readAt: existing.readAt || new Date(),
    },
  });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "ALERT_RESOLVE",
    target: `alert:${id}`,
    status: "success",
    meta: {
      alert_id: id,
      patient_id: existing.patientId,
      parameter_name: existing.parameterName,
      value: existing.value,
      severity: existing.severity,
      previous_status: existing.status,
      new_status: "resolved",
    },
  });

  return ok(
    { id: updated.id, status: updated.status },
    "Alert resolved."
  );
}
