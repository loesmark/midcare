import { NextRequest } from "next/server";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";
import { requireAdmin } from "@/lib/auth";
import { ok, Err } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/admin/settings/test-image-group
 *
 * Sends a probe message to the Telegram image / file-storage group
 * (telegram_chat_id) to verify the bot token + chat id are correct.
 *
 * Returns a structured result so the admin UI can render a distinct
 * success/error banner:
 *   {
 *     ok: true|false,
 *     sent_at: ISO timestamp,
 *     chat_id: string,
 *     message_id?: number,
 *     telegram_response?: string,  // human-readable description from Telegram
 *     error_code?: string,         // machine-readable error class
 *     error_message?: string       // human-readable error message
 *   }
 *
 * Every test is audited (action=TELEGRAM_TEST_IMAGE_GROUP).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const tg = await getTelegramConfig();
  const sentAt = new Date().toISOString();

  // Pre-flight validation — classify each missing field separately so the
  // admin knows exactly which setting to fill in.
  if (!tg.botToken) {
    const res = {
      ok: false,
      sent_at: sentAt,
      chat_id: tg.chatId || null,
      error_code: "BOT_TOKEN_MISSING",
      error_message: "Bot token is not configured. Save it in Settings first.",
      hint: "انسخ التوكن من @BotFather وألصقه في حقل Bot Token ثم احفظ.",
    };
    await logAudit({
      actorId: auth.user.id, req,
      action: "TELEGRAM_TEST_IMAGE_GROUP",
      target: "image_group",
      status: "failure",
      meta: res,
    });
    return ok(res, "Bot token missing.");
  }
  if (!tg.chatId) {
    const res = {
      ok: false,
      sent_at: sentAt,
      chat_id: null,
      error_code: "CHAT_ID_MISSING",
      error_message: "Image group chat ID is not configured. Save it in Settings first.",
      hint: "أضف البوت لمجموعة الصور كمشرف، ثم أرسل رسالة وأعِد المعرّف من @userinfobot.",
    };
    await logAudit({
      actorId: auth.user.id, req,
      action: "TELEGRAM_TEST_IMAGE_GROUP",
      target: "image_group",
      status: "failure",
      meta: res,
    });
    return ok(res, "Chat ID missing.");
  }

  const text =
    `🧪 <b>اختبار مجموعة الصور</b>\n` +
    `✅ تم الاتصال بنجاح بمجموعة تخزين الصور.\n` +
    `🕐 ${new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}`;

  const r = await sendTelegramMessage(tg.botToken, tg.chatId, text);
  if (!r.ok) {
    const res = {
      ok: false,
      sent_at: sentAt,
      chat_id: tg.chatId,
      error_code: "TELEGRAM_API_ERROR",
      error_message: r.error || "Failed to send message to the image group.",
      hint: "تأكد أن البوت مشرف في المجموعة وأن المعرّف صحيح (-100...).",
    };
    await logAudit({
      actorId: auth.user.id, req,
      action: "TELEGRAM_TEST_IMAGE_GROUP",
      target: "image_group",
      status: "failure",
      meta: res,
    });
    // Return 200 with ok=false so the UI can read the structured body. We
    // deliberately don't use Err.* here because that throws ApiError on the
    // client and the user can't see the helpful hint.
    return ok(res, "Telegram API error — see error_message.");
  }

  const res = {
    ok: true,
    sent_at: sentAt,
    chat_id: tg.chatId,
    message_id: r.messageId ?? null,
    telegram_response: "Message delivered to the image group.",
  };
  await logAudit({
    actorId: auth.user.id, req,
    action: "TELEGRAM_TEST_IMAGE_GROUP",
    target: "image_group",
    status: "success",
    meta: res,
  });
  return ok(res, "Test message sent to the image group. Check your Telegram.");
}
