import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * PUT /api/v1/auth/password { current_password, new_password }
 *
 * Audited: a successful password change is logged silently. A failed attempt
 * (wrong current password) is logged + pushed to Telegram because it's a
 * classic account-takeover signal.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const cur = body.current_password || "";
  const next = body.new_password || "";
  if (!cur || !next) return Err.badRequest("VALIDATION_FAILED", "current_password and new_password are required.");
  if (next.length < 8) return Err.badRequest("VALIDATION_FAILED", "new_password must be at least 8 characters.");

  const user = await db.user.findUnique({ where: { id: auth.user.id } });
  if (!user || !user.passwordHash) {
    return Err.badRequest("AUTH_INVALID_CREDENTIALS", "No password set.");
  }
  if (!bcrypt.compareSync(cur, user.passwordHash)) {
    // Wrong current password — log + notify.
    await logAudit({
      actorId: user.id,
      req,
      action: "SECURITY_PASSWORD_CHANGE",
      target: `user:${user.id}`,
      status: "failure",
      meta: { reason: "wrong_current_password" },
      notify: true,
    });
    return Err.badRequest("AUTH_INVALID_CREDENTIALS", "Current password is incorrect.");
  }

  const hash = bcrypt.hashSync(next, 10);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hash } });

  await logAudit({
    actorId: user.id,
    req,
    action: "SECURITY_PASSWORD_CHANGE",
    target: `user:${user.id}`,
    status: "success",
    meta: { user_id: user.id, role: user.role },
    notify: false,
  });

  return ok({ id: user.id }, "Password updated.");
}
