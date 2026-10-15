import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PARAMS = ["bp_systolic", "bp_diastolic", "heart_rate"];

/** PUT /api/v1/admin/thresholds/[id] — update (Task 3 redesign) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const existing = await db.alertThreshold.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Threshold not found.");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Err.badRequest("VALIDATION_FAILED", "Invalid JSON body.");
  }

  const parameterName = body?.parameter_name ? (body.parameter_name as string).trim() : existing.parameterName;
  if (!PARAMS.includes(parameterName)) {
    return Err.badRequest("VALIDATION_FAILED", `parameter_name must be one of: ${PARAMS.join(", ")}`);
  }
  const lower = body.lower_bound != null && body.lower_bound !== "" ? Number(body.lower_bound) : null;
  const upper = body.upper_bound != null && body.upper_bound !== "" ? Number(body.upper_bound) : null;
  if (lower != null && upper != null && lower >= upper) {
    return Err.badRequest("VALIDATION_FAILED", "lower_bound must be less than upper_bound.");
  }

  const updated = await db.alertThreshold.update({
    where: { id },
    data: {
      parameterName,
      lowerBound: lower,
      upperBound: upper,
      isActive: body.is_active !== undefined ? !!body.is_active : existing.isActive,
      adminId: auth.user.id,
    },
  });

  // Build a diff against the prior state for the audit log.
  const diff: Array<{ key: string; from: string; to: string }> = [];
  if (existing.parameterName !== updated.parameterName) diff.push({ key: "parameter_name", from: existing.parameterName, to: updated.parameterName });
  if ((existing.lowerBound ?? null) !== (updated.lowerBound ?? null)) diff.push({ key: "lower_bound", from: String(existing.lowerBound ?? "∅"), to: String(updated.lowerBound ?? "∅") });
  if ((existing.upperBound ?? null) !== (updated.upperBound ?? null)) diff.push({ key: "upper_bound", from: String(existing.upperBound ?? "∅"), to: String(updated.upperBound ?? "∅") });
  if (existing.isActive !== updated.isActive) diff.push({ key: "is_active", from: String(existing.isActive), to: String(updated.isActive) });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "THRESHOLD_UPDATE",
    target: `threshold:${updated.parameterName}`,
    status: "success",
    meta: { threshold_id: id, diff },
    notify: true,
  });

  return ok(toDto(updated), "Threshold updated.");
}

/** DELETE /api/v1/admin/thresholds/[id] */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const existing = await db.alertThreshold.findUnique({ where: { id } });
  if (!existing) return Err.notFound("NOT_FOUND", "Threshold not found.");

  await db.alertThreshold.delete({ where: { id } });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "THRESHOLD_DELETE",
    target: `threshold:${existing.parameterName}`,
    status: "success",
    meta: {
      threshold_id: id,
      parameter_name: existing.parameterName,
      lower_bound: existing.lowerBound,
      upper_bound: existing.upperBound,
    },
    notify: true,
  });

  return ok({ id }, "Threshold deleted.");
}

function toDto(t: any) {
  return {
    id: t.id,
    parameter_name: t.parameterName,
    lower_bound: t.lowerBound,
    upper_bound: t.upperBound,
    is_active: t.isActive,
    created_at: t.createdAt,
  };
}
