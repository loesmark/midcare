import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Err, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Treatment plan routes — DISABLED (Task 1).
 *
 * The `treatment_plans` / `TreatmentPlan` table and all related code are kept
 * in place (schema, Prisma model, history), but the HTTP routes return 410
 * Gone so the feature is effectively turned off for the Flutter app and the
 * admin dashboard without losing historical data.
 *
 * Any of GET/POST/PUT/DELETE on /api/v1/treatment-plans* → 410.
 */

function gone() {
  return apiError(
    "TREATMENT_PLANS_DISABLED",
    "Treatment plan routes are disabled. The underlying tables and data are preserved.",
    410
  );
}

// requireAuth is imported to keep the auth pipeline consistent; the routes
// return 410 before any auth check since the feature is fully disabled.
export async function GET(req: NextRequest) { return gone(); }
export async function POST(req: NextRequest) { return gone(); }
export async function PUT(req: NextRequest) { return gone(); }
export async function DELETE(req: NextRequest) { return gone(); }
export async function PATCH(req: NextRequest) { return gone(); }
