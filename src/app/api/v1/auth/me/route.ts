import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/auth/me — current user */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  return ok(
    {
      id: auth.user.id,
      name: auth.user.name,
      phone_number: auth.user.phoneNumber,
      role: auth.user.role,
      status: auth.user.status,
      patient_token: auth.user.patientToken || null,
    },
    "Current user."
  );
}
