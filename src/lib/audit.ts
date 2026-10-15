import { NextRequest } from "next/server";
import { db } from "./db";
import { getTelegramConfig, sendTelegramMessage } from "./telegram";

/**
 * Central Audit Logger — single source of truth for writing to the AuditLog
 * table AND for pushing real-time admin notifications to the Telegram alerts
 * group.
 *
 * Every sensitive admin action (settings change, threshold change, catalog
 * edit, appointment confirm/cancel, consultation response, alert resolve,
 * backup download, login success/failure, password change) MUST go through
 * `logAudit(...)`. This guarantees:
 *
 *   1. A row is written to the `AuditLog` table with actor id + IP + action
 *      + structured `meta` JSON (a diff when applicable) + status
 *      (success | failure).
 *   2. When `notify` is true (default for SETTINGS_* and SECURITY_* actions),
 *      a formatted Arabic notification is pushed to the Telegram alerts
 *      group so the admin is informed in real time.
 *
 * The function is fire-and-forget-safe: it NEVER throws — if the DB write
 * or the Telegram send fails, the error is swallowed and logged to stderr
 * so the caller's main operation still completes. This is critical because
 * the audit log is called from inside hot paths (settings save, login)
 * where we don't want to break the user flow if logging fails.
 */

export type AuditStatus = "success" | "failure";

export interface AuditInput {
  /** The actor user id (admin or patient). Null for unauthenticated attempts. */
  actorId?: string | null;
  /** The HTTP request — used to extract the actor's IP. */
  req?: NextRequest | null;
  /** Short uppercase code identifying the action, e.g. `SETTINGS_UPDATE`,
   *  `THRESHOLD_CREATE`, `LOGIN_SUCCESS`, `LOGIN_FAILED`. */
  action: string;
  /** Free-form target identifier (e.g. setting key, threshold id, patient id). */
  target?: string | null;
  /** One of "success" | "failure". */
  status?: AuditStatus;
  /** Structured metadata — diff, before/after, request body, etc. JSON-stringified. */
  meta?: Record<string, unknown> | null;
  /** When true (default for SETTINGS_* and SECURITY_*), a Telegram
   *  notification is also pushed to the alerts group. */
  notify?: boolean;
}

/** Pull the client IP from a NextRequest, behind common proxy headers. */
export function clientIp(req?: NextRequest | null): string | null {
  if (!req) return null;
  // Respect the first IP in X-Forwarded-For (typical reverse-proxy chain).
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

/** Sanitize a meta object so it can safely be JSON-stringified into the
 *  `meta` column (drop undefined values, cap size). */
function serializeMeta(meta?: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  try {
    const cleaned = JSON.parse(JSON.stringify(meta, (_k, v) =>
      v === undefined ? null : v
    ));
    const json = JSON.stringify(cleaned);
    // SQLite TEXT has no hard limit, but we cap to 8 KB to be safe.
    return json.length > 8192 ? json.slice(0, 8192) + "…[truncated]" : json;
  } catch {
    return null;
  }
}

/** Main entry point — writes the audit row + optionally notifies Telegram. */
export async function logAudit(input: AuditInput): Promise<void> {
  const {
    actorId = null,
    req = null,
    action,
    target = null,
    status = "success",
    meta = null,
    notify = shouldNotifyByDefault(action),
  } = input;

  const ip = clientIp(req);
  const metaJson = serializeMeta(meta);

  // 1) Persist to the AuditLog table. Never throws.
  try {
    await db.auditLog.create({
      data: {
        actorId: actorId || null,
        actorIp: ip,
        action,
        target,
        status,
        meta: metaJson,
      },
    });
  } catch (err) {
    // We must not break the calling flow if logging fails.
    console.error("[audit] failed to write AuditLog row:", err);
  }

  // 2) Optionally push a real-time Telegram notification to the alerts group.
  if (notify) {
    try {
      const tg = await getTelegramConfig();
      if (tg.botToken && tg.alertsChatId) {
        const text = formatTelegramMessage({
          action, target, status, meta: meta || {}, ip, actorId,
        });
        await sendTelegramMessage(tg.botToken, tg.alertsChatId, text);
      }
    } catch (err) {
      console.error("[audit] failed to send Telegram notification:", err);
    }
  }
}

/** Decide whether an action should notify Telegram by default.
 *  SETTINGS_* and SECURITY_* actions always notify. Other actions only
 *  notify when the caller explicitly passes `notify: true`. */
function shouldNotifyByDefault(action: string): boolean {
  if (action.startsWith("SETTINGS_")) return true;
  if (action.startsWith("SECURITY_")) return true;
  if (action === "BACKUP_DOWNLOAD") return true;
  return false;
}

/** Build the Arabic Telegram notification body for an audit event. */
function formatTelegramMessage(args: {
  action: string;
  target: string | null;
  status: AuditStatus;
  meta: Record<string, unknown>;
  ip: string | null;
  actorId: string | null;
}): string {
  const { action, target, status, meta, ip, actorId } = args;
  const icon = status === "success" ? "✅" : "⚠️";
  const statusLabel = status === "success" ? "نجاح" : "فشل";
  const actionLabel = actionLabelAr(action);

  const lines: string[] = [];
  lines.push(`${icon} <b>إجراء إداري</b> — ${statusLabel}`);
  lines.push(`📋 <b>النوع:</b> ${actionLabel}`);
  if (target) lines.push(`🎯 <b>الهدف:</b> <code>${escapeHtml(target)}</code>`);
  if (actorId) lines.push(`👤 <b>المستخدم:</b> <code>${actorId.slice(-8)}</code>`);
  if (ip) lines.push(`🌐 <b>IP:</b> <code>${escapeHtml(ip)}</code>`);

  // Render a compact diff if provided.
  const diff = meta?.diff as Array<{ key: string; from?: string; to?: string }> | undefined;
  if (Array.isArray(diff) && diff.length > 0) {
    lines.push("📝 <b>التغييرات:</b>");
    for (const d of diff.slice(0, 12)) {
      const from = d.from === undefined || d.from === "" ? "∅" : String(d.from);
      const to = d.to === undefined || d.to === "" ? "∅" : String(d.to);
      // Mask sensitive fields (bot token, password).
      const isSensitive = /token|password|secret/i.test(d.key);
      if (isSensitive) {
        lines.push(`   • <code>${escapeHtml(d.key)}</code>: ••••••`);
      } else {
        lines.push(`   • <code>${escapeHtml(d.key)}</code>: <code>${escapeHtml(from)}</code> ← <code>${escapeHtml(to)}</code>`);
      }
    }
    if (diff.length > 12) lines.push(`   … و ${diff.length - 12} تغيير آخر`);
  }

  lines.push(`🕐 ${new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}`);
  return lines.join("\n");
}

/** Human-readable Arabic label for each audit action. */
function actionLabelAr(action: string): string {
  const map: Record<string, string> = {
    SETTINGS_UPDATE: "تحديث الإعدادات",
    SETTINGS_AVAILABILITY: "تحديث حالة توفّر الطبيب",
    WORKING_HOURS_UPDATE: "تحديث ساعات العمل",
    THRESHOLD_CREATE: "إنشاء عتبة تنبيه",
    THRESHOLD_UPDATE: "تحديث عتبة تنبيه",
    THRESHOLD_DELETE: "حذف عتبة تنبيه",
    CATALOG_CREATE: "إضافة عنصر كتالوج",
    CATALOG_UPDATE: "تعديل عنصر كتالوج",
    CATALOG_DELETE: "حذف عنصر كتالوج",
    APPOINTMENT_CONFIRM: "تأكيد موعد",
    APPOINTMENT_CANCEL: "إلغاء موعد",
    CONSULTATION_RESPOND: "رد على استشارة",
    ALERT_RESOLVE: "حل تنبيه طبي",
    ALERT_READ: "تعليم تنبيه كمقروء",
    BACKUP_DOWNLOAD: "تنزيل نسخة احتياطية",
    SECURITY_LOGIN_SUCCESS: "تسجيل دخول ناجح",
    SECURITY_LOGIN_FAILED: "محاولة دخول فاشلة",
    SECURITY_LOGOUT: "تسجيل خروج",
    SECURITY_PASSWORD_CHANGE: "تغيير كلمة المرور",
    SECURITY_REGISTER: "تسجيل مريض جديد",
  };
  return map[action] || action;
}

/** Helper: build a per-field diff between two flat string maps.
 *  Returns `[{key, from, to}]` for every key whose value changed. */
export function diffSettings(
  before: Record<string, string>,
  after: Record<string, string>,
  keys: readonly string[]
): Array<{ key: string; from: string; to: string }> {
  const out: Array<{ key: string; from: string; to: string }> = [];
  for (const k of keys) {
    const b = before[k] ?? "";
    const a = after[k] ?? "";
    if (b !== a) {
      out.push({ key: k, from: b, to: a });
    }
  }
  return out;
}

/** Escape HTML special chars so we can safely inject values into Telegram's
 *  HTML-mode messages. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
