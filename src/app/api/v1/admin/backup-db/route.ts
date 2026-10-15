import { NextRequest } from "next/server";
import fs from "fs";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { getDbPath } from "./helper";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/admin/backup-db { passcode } → binary .db snapshot
 *
 * Simple snapshot: copies the SQLite file. The passcode check uses the env
 * `ADMIN_BACKUP_PASSCODE` (defaults to "admin-passcode" — change in
 * production).
 *
 * Audited: every download attempt (success OR failure) is logged. A failed
 * passcode attempt is also pushed to Telegram so the admin is alerted of a
 * potential unauthorized download try.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const passcode = body.passcode;
  const expected = process.env.ADMIN_BACKUP_PASSCODE || "admin-passcode";
  if (!passcode || passcode !== expected) {
    // Failed backup attempt — high security signal, notify Telegram.
    await logAudit({
      actorId: auth.user.id,
      req,
      action: "BACKUP_DOWNLOAD",
      target: "db_snapshot",
      status: "failure",
      meta: { reason: "invalid_passcode" },
      notify: true,
    });
    return Err.badRequest("BACKUP_PASSCODE_INVALID", "Invalid backup passcode.");
  }

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    await logAudit({
      actorId: auth.user.id,
      req,
      action: "BACKUP_DOWNLOAD",
      target: "db_snapshot",
      status: "failure",
      meta: { reason: "db_file_missing", path: dbPath },
      notify: true,
    });
    return Err.internal("BACKUP_SNAPSHOT_FAILED", "Database file not found.");
  }

  try {
    const buf = fs.readFileSync(dbPath);
    const sizeKb = Math.round(buf.length / 1024);

    await logAudit({
      actorId: auth.user.id,
      req,
      action: "BACKUP_DOWNLOAD",
      target: "db_snapshot",
      status: "success",
      meta: {
        file_size_bytes: buf.length,
        file_size_kb: sizeKb,
        db_path: dbPath,
      },
      notify: true, // downloads of the patient DB are always notified
    });

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="medicare-backup.db"',
        "X-Backup-File": "medicare-backup.db",
      },
    });
  } catch (err) {
    await logAudit({
      actorId: auth.user.id,
      req,
      action: "BACKUP_DOWNLOAD",
      target: "db_snapshot",
      status: "failure",
      meta: { reason: "read_error", error: (err as Error).message },
      notify: true,
    });
    return Err.internal("BACKUP_SNAPSHOT_FAILED", (err as Error).message);
  }
  // `ok` is intentionally unused — this route returns a binary stream.
  void ok;
}
