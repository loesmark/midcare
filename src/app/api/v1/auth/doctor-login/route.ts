import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit, clientIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/doctor-login  { phone_number, password } → { token, user }
 *
 * Audited: every login attempt is logged. Successful logins get a
 * `SECURITY_LOGIN_SUCCESS` row, failed attempts get a `SECURITY_LOGIN_FAILED`
 * row that is also pushed to the Telegram alerts group so the admin is
 * immediately notified of suspicious brute-force attempts (the IP is
 * included). Repeated failed attempts from the same IP could later be
 * rate-limited, but the audit log is the foundation.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Err.badRequest("VALIDATION_FAILED", "Invalid JSON body.");
  }
  const phone = (body?.phone_number || "").trim();
  const password = body?.password || "";
  if (!phone || !password) {
    return Err.badRequest("VALIDATION_FAILED", "phone_number and password are required.");
  }

  const ip = clientIp(req);

  const user = await db.user.findUnique({ where: { phoneNumber: phone } });
  if (!user || !user.passwordHash) {
    await logAudit({
      req,
      action: "SECURITY_LOGIN_FAILED",
      target: `phone:${phone}`,
      status: "failure",
      meta: { phone, reason: "no_such_user_or_no_password", ip },
      notify: true,
    });
    return Err.badRequest("AUTH_INVALID_CREDENTIALS", "Invalid phone number or password.");
  }
  if (user.role !== "admin") {
    await logAudit({
      actorId: user.id,
      req,
      action: "SECURITY_LOGIN_FAILED",
      target: `phone:${phone}`,
      status: "failure",
      meta: { phone, reason: "not_admin", user_id: user.id, ip },
      notify: true,
    });
    return Err.forbidden("Only admins can log in here.");
  }
  if (user.status !== "active") {
    await logAudit({
      actorId: user.id,
      req,
      action: "SECURITY_LOGIN_FAILED",
      target: `phone:${phone}`,
      status: "failure",
      meta: { phone, reason: "suspended", user_id: user.id, ip },
      notify: true,
    });
    return Err.badRequest("AUTH_SUSPENDED", "This account is suspended.");
  }
  const match = bcrypt.compareSync(password, user.passwordHash);
  if (!match) {
    await logAudit({
      actorId: user.id,
      req,
      action: "SECURITY_LOGIN_FAILED",
      target: `phone:${phone}`,
      status: "failure",
      meta: { phone, reason: "wrong_password", user_id: user.id, ip },
      notify: true,
    });
    return Err.badRequest("AUTH_INVALID_CREDENTIALS", "Invalid phone number or password.");
  }

  // Success — log + issue token.
  await logAudit({
    actorId: user.id,
    req,
    action: "SECURITY_LOGIN_SUCCESS",
    target: `user:${user.id}`,
    status: "success",
    meta: { user_id: user.id, phone, role: user.role, ip },
    notify: false, // don't spam Telegram for normal logins
  });

  const token = signToken({ id: user.id, role: "admin", name: user.name });
  return ok(
    {
      token,
      user: {
        id: user.id,
        name: user.name,
        phone_number: user.phoneNumber,
        role: user.role,
        status: user.status,
      },
    },
    "Login successful."
  );
}
