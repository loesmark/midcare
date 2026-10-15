import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/catalogs/consultation_types?category=immediate|regular
 *
 * Returns the consultation-type catalog. The Flutter app calls this path
 * (with the underscore) when building the consultation "طلب جديد" form.
 * Optional `category` query filters by immediate/regular.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const category = url.searchParams.get("category") || undefined;
  const where = category ? { category } : {};

  const rows = await db.consultationType.findMany({
    where,
    orderBy: { name: "asc" },
  });
  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
  }));
  return ok(data, "Consultation types catalog.");
}
