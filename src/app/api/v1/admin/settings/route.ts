import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/telegram";
import { ok, Err } from "@/lib/api";
import { logAudit, diffSettings } from "@/lib/audit";

export const dynamic = "force-dynamic";

const KEYS = [
  "telegram_bot_token",
  "telegram_chat_id",
  "telegram_alerts_chat_id",
  "doctor_whatsapp",
] as const;

/** GET /api/v1/admin/settings — key/value map */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const s = await getSettings();
  return ok(
    {
      telegram_bot_token: s.telegram_bot_token || "",
      telegram_chat_id: s.telegram_chat_id || "",
      telegram_alerts_chat_id: s.telegram_alerts_chat_id || "",
      doctor_whatsapp: s.doctor_whatsapp || "",
    },
    "Settings."
  );
}

/**
 * PUT /api/v1/admin/settings — save settings.
 *
 * This route now:
 *   1. Captures the BEFORE values.
 *   2. Computes a per-field diff (only keys whose value actually changed).
 *   3. Persists the changes.
 *   4. Writes an AuditLog row with the diff as `meta`.
 *   5. Pushes a real-time Telegram notification to the alerts group so the
 *      admin sees exactly what changed, by whom, from which IP, and when.
 *
 * If no field actually changed (no-op save), we skip the audit + Telegram
 * spam — the response message reflects this case ("no changes").
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Build the patch restricted to the known keys.
  const patch: Record<string, string> = {};
  for (const k of KEYS) {
    if (body[k] !== undefined) patch[k] = String(body[k] ?? "");
  }

  // Snapshot BEFORE values so we can diff.
  const before = await getSettings();
  const beforeMap: Record<string, string> = {};
  for (const k of KEYS) beforeMap[k] = before[k] || "";

  // Compute diff.
  const diff = diffSettings(beforeMap, patch, KEYS);

  // No-op save? Don't spam the audit log or Telegram.
  if (diff.length === 0) {
    return ok(
      {
        telegram_bot_token: beforeMap.telegram_bot_token,
        telegram_chat_id: beforeMap.telegram_chat_id,
        telegram_alerts_chat_id: beforeMap.telegram_alerts_chat_id,
        doctor_whatsapp: beforeMap.doctor_whatsapp,
      },
      "No changes — settings already up to date."
    );
  }

  // Persist.
  await updateSettings(patch);
  const after = await getSettings();

  // Audit + real-time Telegram notification (notify=true by default for SETTINGS_*).
  await logAudit({
    actorId: auth.user.id,
    req,
    action: "SETTINGS_UPDATE",
    target: "settings",
    status: "success",
    meta: {
      diff,
      changed_count: diff.length,
      changed_keys: diff.map((d) => d.key),
    },
    // notify defaults to true for SETTINGS_* — see lib/audit.ts
  });

  return ok(
    {
      telegram_bot_token: after.telegram_bot_token || "",
      telegram_chat_id: after.telegram_chat_id || "",
      telegram_alerts_chat_id: after.telegram_alerts_chat_id || "",
      doctor_whatsapp: after.doctor_whatsapp || "",
      changed_keys: diff.map((d) => d.key),
      changed_count: diff.length,
    },
    diff.length > 0
      ? `Settings saved — ${diff.length} field(s) changed: ${diff.map((d) => d.key).join(", ")}`
      : "Settings saved."
  );
}
