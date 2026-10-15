import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/patient/catalogs/diseases — قائمة الأمراض (لإعداد الملف) */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const rows = await db.disease.findMany({ orderBy: { name: "asc" } });
  const data = rows.map((r) => ({ id: r.id, name: r.name, category: r.category }));
  return ok(data, "Diseases catalog.");
}
