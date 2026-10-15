import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/alerts/unread-count */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const count = await db.alert.count({ where: { status: "unread" } });
  return ok({ count }, "Unread alert count.");
}
