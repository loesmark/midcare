import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/catalogs/surgeries
 *
 * Returns the full surgeries catalog (unpaginated) for the Flutter app's
 * profile-completion wizard.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const rows = await db.surgery.findMany({ orderBy: { name: "asc" } });
  const data = rows.map((r) => ({ id: r.id, name: r.name, category: r.category }));
  return ok(data, "Surgeries catalog.");
}
