import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** PUT /api/v1/auth/profile { name, phone_number } */
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const phone = (body.phone_number || "").trim();
  if (!name || !phone) return Err.badRequest("VALIDATION_FAILED", "name and phone_number are required.");

  const existing = await db.user.findUnique({ where: { phoneNumber: phone } });
  if (existing && existing.id !== auth.user.id) {
    return Err.conflict("CONFLICT_PHONE", "This phone number is used by another account.");
  }

  const updated = await db.user.update({ where: { id: auth.user.id }, data: { name, phoneNumber: phone } });
  return ok(
    { id: updated.id, name: updated.name, phone_number: updated.phoneNumber, role: updated.role, status: updated.status },
    "Profile updated."
  );
}
