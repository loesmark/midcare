import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** POST /api/v1/auth/patient-register  → { patient_token, jwt, user } */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Err.badRequest("VALIDATION_FAILED", "Invalid JSON body.");
  }
  const name = (body?.name || "").trim();
  const phone = (body?.phone_number || "").trim();
  if (!name || !phone) {
    return Err.badRequest("VALIDATION_FAILED", "name and phone_number are required.");
  }

  const existing = await db.user.findUnique({ where: { phoneNumber: phone } });
  if (existing) {
    return Err.conflict("CONFLICT_PHONE", "This phone number is already registered.");
  }

  const id = uuidv4();
  const patientToken = uuidv4();
  const user = await db.user.create({
    data: {
      id,
      name,
      phoneNumber: phone,
      role: "patient",
      patientToken,
      status: "active",
      passwordHash: bcrypt.hashSync(patientToken, 10),
      profile: {
        create: { id: uuidv4() },
      },
    },
    include: { profile: true },
  });

  const jwt = signToken({ id: user.id, role: "patient", name: user.name });

  // Audit the new registration. Note: do NOT log the patient_token (sensitive).
  await logAudit({
    actorId: user.id,
    req,
    action: "SECURITY_REGISTER",
    target: `user:${user.id}`,
    status: "success",
    meta: { user_id: user.id, name, phone, role: "patient" },
    notify: false, // new patient registrations are routine — don't spam
  });

  return ok(
    {
      patient_token: patientToken,
      jwt,
      profileId: user.profile?.id || null,
      user: { id: user.id, name: user.name, phone_number: user.phoneNumber, role: user.role },
    },
    "Profile created successfully."
  );
}
