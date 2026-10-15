import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/catalogs/symptoms
 *
 * Alias for /patient/catalogs/symptoms — the Flutter app calls this path
 * (without the /patient prefix) to fetch the symptoms catalog when building
 * the consultation form. Returns the full list of symptoms with the
 * `is_critical` flag so the app can highlight critical ones.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const rows = await db.symptom.findMany({ orderBy: { name: "asc" } });
  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    is_critical: r.isCritical,
  }));
  return ok(data, "Symptoms catalog.");
}
