import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/patient/profile/versions
 *
 * The Flutter app calls this to show the profile-version history. The current
 * backend doesn't store profile snapshots (the profile is updated in place),
 * so we return an empty array. This keeps the app from crashing when it
 * tries to fetch versions.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  return ok(
    { versions: [] },
    "Profile versions (history not tracked in this backend)."
  );
}
