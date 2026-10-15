import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/api";
import { getDbPathSize } from "../helper";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/backup-db/info */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const sizeBytes = getDbPathSize();
  const sizeHuman = formatBytes(sizeBytes);
  return ok(
    {
      enabled: true,
      db_path: process.env.DATABASE_URL || "—",
      db_size_bytes: sizeBytes,
      db_size_human: sizeHuman,
      rate_limit: "3 / 15 min per IP",
    },
    "Backup info."
  );
  void db;
}

function formatBytes(b: number): string {
  if (!b) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}
