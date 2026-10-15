import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, Err } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/patient/documents/[id] — single document */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const { id } = await params;
  const d = await db.patientDocument.findUnique({ where: { id } });
  if (!d) return Err.notFound("NOT_FOUND", "Document not found.");
  if (d.patientId !== auth.user.id) return Err.forbidden("AUTH_FORBIDDEN");

  return ok(
    {
      id: d.id,
      type: d.type,
      title: d.title,
      notes: d.notes,
      attachments: JSON.parse(d.attachments || "[]"),
      created_at: d.createdAt,
    },
    "Document."
  );
}
