import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit, clientIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/patient-login  { patient_token } → { jwt, user }
 *
 * Audited: failed patient-login attempts (invalid token, suspended account)
 * are logged as `SECURITY_LOGIN_FAILED` so the admin can spot token-spray
 * attacks. Successful logins are logged silently (no Telegram spam).
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Err.badRequest("VALIDATION_FAILED", "Invalid JSON body.");
  }
  const token = (body?.patient_token || "").trim();
  const ip = clientIp(req);
  if (!token) {
    return Err.badRequest("VALIDATION_FAILED", "patient_token is required.");
  }
  const user = await db.user.findUnique({ where: { patientToken: token } });
  if (!user || user.role !== "patient") {
    await logAudit({
      req,
      action: "SECURITY_LOGIN_FAILED",
      target: "patient_token",
      status: "failure",
      meta: { reason: "invalid_token", ip, token_prefix: token.slice(0, 6) + "…" },
      notify: false, // patient token attempts are too noisy to spam Telegram
    });
    return Err.badRequest("AUTH_INVALID_CREDENTIALS", "Invalid patient token.");
  }
  if (user.status !== "active") {
    await logAudit({
      actorId: user.id,
      req,
      action: "SECURITY_LOGIN_FAILED",
      target: `user:${user.id}`,
      status: "failure",
      meta: { reason: "suspended", user_id: user.id, ip },
      notify: true, // suspended-user login = suspicious, notify
    });
    return Err.badRequest("AUTH_SUSPENDED", "This account is suspended.");
  }

  await logAudit({
    actorId: user.id,
    req,
    action: "SECURITY_LOGIN_SUCCESS",
    target: `user:${user.id}`,
    status: "success",
    meta: { user_id: user.id, role: "patient", ip },
    notify: false,
  });

  const jwt = signToken({ id: user.id, role: "patient", name: user.name });
  return ok(
    {
      jwt,
      user: { id: user.id, name: user.name, phone_number: user.phoneNumber, role: user.role },
    },
    "Logged in via token."
  );
}
