import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/catalogs/medications
 *
 * Alias for /patient/catalogs/medications — returns the full medications
 * catalog (unpaginated) for the Flutter app's profile-completion wizard.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const rows = await db.medication.findMany({ orderBy: { brandName: "asc" } });
  const data = rows.map((r) => ({
    id: r.id,
    brand_name: r.brandName,
    generic_name: r.genericName,
    form: r.form,
    category: r.category,
  }));
  return ok(data, "Medications catalog.");
}
