import { NextRequest } from "next/server";
import { getTelegramConfig } from "@/lib/telegram";
import { requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/admin/settings/test-whatsapp
 *
 * Validates the SAVED doctor_whatsapp number and returns a ready-to-open
 * wa.me link. We can't programmatically open a WhatsApp chat server-side,
 * so this endpoint validates the number and returns a structured result.
 *
 * Returns `{ ok, phone, link, error_code?, error_message?, hint? }` so the
 * admin UI can render a precise banner for each outcome.
 *
 * Audited (action=TELEGRAM_TEST_WHATSAPP).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const tg = await getTelegramConfig();
  const phone = (tg.doctorWhatsapp || "").replace(/[^\d]/g, "");

  if (!phone) {
    const res = {
      ok: false,
      phone: null,
      link: null,
      error_code: "WHATSAPP_NOT_CONFIGURED",
      error_message: "Doctor WhatsApp number is not configured. Save it in Settings first.",
      hint: "أدخل الرقم بالصيغة الدولية بدون + أو مسافات (مثال: 201000000000).",
    };
    await logAudit({
      actorId: auth.user.id, req,
      action: "TELEGRAM_TEST_WHATSAPP",
      target: "doctor_whatsapp",
      status: "failure",
      meta: res,
    });
    return ok(res, "WhatsApp not configured.");
  }
  if (phone.length < 8) {
    const res = {
      ok: false,
      phone,
      link: null,
      error_code: "WHATSAPP_INVALID",
      error_message: "The WhatsApp number looks too short.",
      hint: "تأكد أن الرقم بصيغة دولية كاملة (مثال: 201000000000).",
    };
    await logAudit({
      actorId: auth.user.id, req,
      action: "TELEGRAM_TEST_WHATSAPP",
      target: "doctor_whatsapp",
      status: "failure",
      meta: res,
    });
    return ok(res, "WhatsApp number invalid.");
  }

  const link = `https://wa.me/${phone}`;
  const res = {
    ok: true,
    phone,
    link,
    hint: "اضغط الرابط لفتح محادثة واتساب والتحقق من الرقم يدوياً.",
  };
  await logAudit({
    actorId: auth.user.id, req,
    action: "TELEGRAM_TEST_WHATSAPP",
    target: "doctor_whatsapp",
    status: "success",
    meta: { phone, link },
  });
  return ok(res, "WhatsApp link generated. Open it to verify the number.");
}
