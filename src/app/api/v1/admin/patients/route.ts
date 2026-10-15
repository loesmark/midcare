import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, paginate, pagination } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/patients?page=&limit=&search=
 *
 * Task 7 fix: always return the patient's `name` (joined from users), so the
 * admin panel can display it. Previously the dashboard fell back to "Unknown"
 * because the list endpoint didn't surface the name field.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || null;
  const { page, limit, skip } = pagination(req);

  const where = {
    role: "patient" as const,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { phoneNumber: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      include: { profile: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const data = rows.map((u) => ({
    user_id: u.id,
    id: u.id,
    name: u.name, // ← Task 7: name is always present
    phone_number: u.phoneNumber,
    status: u.status,
    created_at: u.createdAt,
    birth_date: u.profile?.birthDate || null,
    smoking_status: u.profile?.smokingStatus || null,
    additional_info: u.profile?.additionalInfo || null,
  }));

  return paginate(data, total, page, limit, "Patients list.");
}
