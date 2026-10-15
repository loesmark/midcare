import { NextRequest } from "next/server";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";
import { requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/admin/settings/test-alert-group
 *
 * Sends a probe message to the dedicated alerts group
 * (telegram_alerts_chat_id) — the SAME channel that real medical alerts are
 * pushed to (see lib/alerts.ts). Verifying it here confirms the alerts
 * group is reachable.
 *
 * Returns a structured result with `ok / sent_at / chat_id / message_id /
 * error_code / error_message / hint` so the admin UI can render a distinct,
 * actionable banner for each outcome (success / missing config / API error).
 *
 * Every test is audited (action=TELEGRAM_TEST_ALERT_GROUP).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const tg = await getTelegramConfig();
  const sentAt = new Date().toISOString();

  if (!tg.botToken) {
    const res = {
      ok: false,
      sent_at: sentAt,
      chat_id: tg.alertsChatId || null,
      error_code: "BOT_TOKEN_MISSING",
      error_message: "Bot token is not configured. Save it in Settings first.",
      hint: "انسخ التوكن من @BotFather وألصقه في حقل Bot Token ثم احفظ.",
    };
    await logAudit({
      actorId: auth.user.id, req,
      action: "TELEGRAM_TEST_ALERT_GROUP",
      target: "alert_group",
      status: "failure",
      meta: res,
    });
    return ok(res, "Bot token missing.");
  }
  if (!tg.alertsChatId) {
    const res = {
      ok: false,
      sent_at: sentAt,
      chat_id: null,
      error_code: "ALERTS_CHAT_ID_MISSING",
      error_message: "Alerts group chat ID is not configured. Save it in Settings first.",
      hint: "أنشئ مجموعة منفصلة للتنبيهات الحرجة، أضف البوت كمشرف، ثم أعِد المعرّف.",
    };
    await logAudit({
      actorId: auth.user.id, req,
      action: "TELEGRAM_TEST_ALERT_GROUP",
      target: "alert_group",
      status: "failure",
      meta: res,
    });
    return ok(res, "Alerts chat ID missing.");
  }

  const text =
    `🚨 <b>اختبار مجموعة التنبيهات</b>\n` +
    `✅ تم الاتصال بنجاح بمجموعة التنبيهات الطبية.\n` +
    `هذه هي القناة التي تصل إليها التنبيهات الحرجة تلقائياً.\n` +
    `🕐 ${new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}`;

  const r = await sendTelegramMessage(tg.botToken, tg.alertsChatId, text);
  if (!r.ok) {
    const res = {
      ok: false,
      sent_at: sentAt,
      chat_id: tg.alertsChatId,
      error_code: "TELEGRAM_API_ERROR",
      error_message: r.error || "Failed to send message to the alerts group.",
      hint: "تأكد أن البوت مشرف في مجموعة التنبيهات وأن المعرّف صحيح (-100...).",
    };
    await logAudit({
      actorId: auth.user.id, req,
      action: "TELEGRAM_TEST_ALERT_GROUP",
      target: "alert_group",
      status: "failure",
      meta: res,
    });
    return ok(res, "Telegram API error — see error_message.");
  }

  const res = {
    ok: true,
    sent_at: sentAt,
    chat_id: tg.alertsChatId,
    message_id: r.messageId ?? null,
    telegram_response: "Message delivered to the alerts group.",
  };
  await logAudit({
    actorId: auth.user.id, req,
    action: "TELEGRAM_TEST_ALERT_GROUP",
    target: "alert_group",
    status: "success",
    meta: res,
  });
  return ok(res, "Test message sent to the alerts group. Check your Telegram.");
}
