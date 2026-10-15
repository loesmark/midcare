import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, created, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PARAMS = ["bp_systolic", "bp_diastolic", "heart_rate"];

/** GET /api/v1/admin/thresholds — list all (Task 3: lower_bound + upper_bound) */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const rows = await db.alertThreshold.findMany({
    orderBy: { parameterName: "asc" },
  });
  const data = rows.map((t) => ({
    id: t.id,
    parameter_name: t.parameterName,
    lower_bound: t.lowerBound, // ← Task 3 redesign
    upper_bound: t.upperBound, // ← Task 3 redesign
    is_active: t.isActive,
    created_at: t.createdAt,
  }));
  return ok(data, "Alert thresholds.");
}

/** POST /api/v1/admin/thresholds — create (Task 3 redesign) */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Err.badRequest("VALIDATION_FAILED", "Invalid JSON body.");
  }

  const parameterName = (body?.parameter_name || "").trim();
  if (!PARAMS.includes(parameterName)) {
    return Err.badRequest("VALIDATION_FAILED", `parameter_name must be one of: ${PARAMS.join(", ")}`);
  }
  const lower = body.lower_bound != null && body.lower_bound !== "" ? Number(body.lower_bound) : null;
  const upper = body.upper_bound != null && body.upper_bound !== "" ? Number(body.upper_bound) : null;
  if (lower == null && upper == null) {
    return Err.badRequest("VALIDATION_FAILED", "At least one of lower_bound or upper_bound is required.");
  }
  if (lower != null && upper != null && lower >= upper) {
    return Err.badRequest("VALIDATION_FAILED", "lower_bound must be less than upper_bound.");
  }
  if ((lower != null && !Number.isFinite(lower)) || (upper != null && !Number.isFinite(upper))) {
    return Err.badRequest("VALIDATION_FAILED", "Bounds must be numeric.");
  }

  // one active threshold per parameter — replace existing
  const existing = await db.alertThreshold.findFirst({ where: { parameterName } });
  if (existing) {
    // Build the diff so the audit log shows what the admin actually changed.
    const diff: Array<{ key: string; from: string; to: string }> = [];
    if ((existing.lowerBound ?? null) !== (lower ?? null)) {
      diff.push({ key: "lower_bound", from: String(existing.lowerBound ?? "∅"), to: String(lower ?? "∅") });
    }
    if ((existing.upperBound ?? null) !== (upper ?? null)) {
      diff.push({ key: "upper_bound", from: String(existing.upperBound ?? "∅"), to: String(upper ?? "∅") });
    }
    const existingActive = existing.isActive;
    const newActive = body.is_active !== false;
    if (existingActive !== newActive) {
      diff.push({ key: "is_active", from: String(existingActive), to: String(newActive) });
    }

    const updated = await db.alertThreshold.update({
      where: { id: existing.id },
      data: {
        lowerBound: lower,
        upperBound: upper,
        isActive: newActive,
        adminId: auth.user.id,
      },
    });

    await logAudit({
      actorId: auth.user.id,
      req,
      action: "THRESHOLD_UPDATE",
      target: `threshold:${parameterName}`,
      status: "success",
      meta: { parameter_name: parameterName, diff, threshold_id: updated.id },
      notify: true, // thresholds directly affect patient safety — notify
    });

    return ok(toDto(updated), "Threshold updated (replaced existing).");
  }

  const created = await db.alertThreshold.create({
    data: {
      parameterName,
      lowerBound: lower,
      upperBound: upper,
      isActive: body.is_active !== false,
      adminId: auth.user.id,
    },
  });

  await logAudit({
    actorId: auth.user.id,
    req,
    action: "THRESHOLD_CREATE",
    target: `threshold:${parameterName}`,
    status: "success",
    meta: {
      parameter_name: parameterName,
      lower_bound: lower,
      upper_bound: upper,
      is_active: created.isActive,
      threshold_id: created.id,
    },
    notify: true,
  });

  return ok(toDto(created), "Threshold created.");
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
