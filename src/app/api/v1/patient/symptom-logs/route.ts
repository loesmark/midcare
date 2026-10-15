import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ok, paginate, pagination, Err } from "@/lib/api";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/patient/symptom-logs
 * Body: { symptoms: [{name, is_critical}], custom_text?: string }
 *
 * إذا احتوى السجل على عرض حرِج (is_critical=true) يُرسل تنبيه فوري
 * لمجموعة التنبيهات في تيليجرام.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const body = await req.json().catch(() => ({}));
  const symptoms = Array.isArray(body.symptoms) ? body.symptoms : [];
  const customText = (body.custom_text || "").trim() || null;

  if (!symptoms.length && !customText) {
    return Err.badRequest("VALIDATION_FAILED", "symptoms or custom_text is required.");
  }

  const log = await db.symptomLog.create({
    data: {
      id: uuidv4(),
      patientId: auth.user.id,
      symptoms: JSON.stringify(symptoms),
      customText,
    },
  });

  // Critical symptom → push alert to Telegram alerts group
  const hasCritical = symptoms.some((s: any) => s.is_critical);
  let telegramSent = false;
  if (hasCritical) {
    const tg = await getTelegramConfig();
    if (tg.botToken && tg.alertsChatId) {
      const names = symptoms.map((s: any) => s.name).join("، ");
      const text =
        `🚨 <b>عرض حرِج — يحتاج متابعة</b>\n` +
        `👤 المريض: <b>${escapeHtml(auth.user.name)}</b>\n` +
        `⚠️ الأعراض: ${escapeHtml(names)}\n` +
        (customText ? `📝 ${escapeHtml(customText)}\n` : "") +
        `🕐 ${new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}`;
      const r = await sendTelegramMessage(tg.botToken, tg.alertsChatId, text);
      telegramSent = r.ok;
    }
  }

  return ok(
    {
      id: log.id,
      symptoms,
      custom_text: log.customText,
      critical_alert_sent: hasCritical && telegramSent,
      created_at: log.createdAt,
    },
    hasCritical
      ? "Symptom log saved. Critical alert sent to the doctor."
      : "Symptom log saved."
  );
}

/** GET /api/v1/patient/symptom-logs?page=&limit= — سجل أعراض المريض */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "patient") return Err.forbidden("AUTH_FORBIDDEN");

  const { page, limit, skip } = pagination(req);
  const where = { patientId: auth.user.id };
  const [total, rows] = await Promise.all([
    db.symptomLog.count({ where }),
    db.symptomLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);

  const data = rows.map((l) => ({
    id: l.id,
    symptoms: JSON.parse(l.symptoms || "[]"),
    custom_text: l.customText,
    created_at: l.createdAt,
  }));

  return paginate(data, total, page, limit, "Your symptom logs.");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
