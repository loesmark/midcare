import { db } from "./db";
import { getTelegramConfig, sendTelegramMessage } from "./telegram";

export interface ReadingInput {
  patientId: string;
  patientName: string;
  healthRecordId: string;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  heartRate?: number | null;
}

export interface GeneratedAlert {
  id: string;
  parameterName: string;
  value: string;
  bound: "lower" | "upper";
  thresholdValue: number;
  severity: string;
  telegramSent: boolean;
}

/**
 * Evaluate a new reading against the active thresholds (Task 3 redesign).
 *
 *  - Each threshold has `lowerBound` + `upperBound` for ONE parameter.
 *  - If the value is below `lowerBound` OR above `upperBound` → it is out of range.
 *  - ONE alert is created per out-of-range parameter (not per bound).
 *  - `bound` records which side was crossed.
 *
 * Task 4 (dedup): if an UNREAD alert already exists for the same
 * (patientId + parameterName), do NOT create a duplicate. The previous
 * alert must first be resolved before a new one is generated. This stops
 * "alert on every input".
 *
 * Task 6: every newly-created alert is also pushed to the Telegram alerts
 * group (telegram_alerts_chat_id).
 */
export async function evaluateReading(input: ReadingInput): Promise<GeneratedAlert[]> {
  const { patientId, patientName, healthRecordId } = input;

  // Load all active thresholds, indexed by parameter name.
  const thresholds = await db.alertThreshold.findMany({
    where: { isActive: true },
  });
  const byParam = new Map<string, (typeof thresholds)[number]>();
  for (const t of thresholds) {
    // keep the first active threshold per parameter
    if (!byParam.has(t.parameterName)) byParam.set(t.parameterName, t);
  }

  const readings: { param: string; value: number }[] = [];
  if (input.bpSystolic != null) readings.push({ param: "bp_systolic", value: input.bpSystolic });
  if (input.bpDiastolic != null) readings.push({ param: "bp_diastolic", value: input.bpDiastolic });
  if (input.heartRate != null) readings.push({ param: "heart_rate", value: input.heartRate });

  const created: GeneratedAlert[] = [];

  for (const { param, value } of readings) {
    const threshold = byParam.get(param);
    if (!threshold) continue; // no threshold configured for this parameter

    let outOfRange = false;
    let bound: "lower" | "upper" = "upper";
    let crossedValue: number | null = null;

    if (threshold.upperBound != null && value > threshold.upperBound) {
      outOfRange = true;
      bound = "upper";
      crossedValue = threshold.upperBound;
    } else if (threshold.lowerBound != null && value < threshold.lowerBound) {
      outOfRange = true;
      bound = "lower";
      crossedValue = threshold.lowerBound;
    }

    if (!outOfRange) continue;

    // ── Task 4: dedup — skip if an unread alert exists for this patient+param ──
    const existing = await db.alert.findFirst({
      where: {
        patientId,
        parameterName: param,
        status: "unread",
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      // Already a pending alert for this parameter — do not spam another one.
      continue;
    }

    // Severity: distance beyond the bound decides warning vs critical.
    const distance = bound === "upper"
      ? crossedValue != null ? value - crossedValue : 0
      : crossedValue != null ? crossedValue - value : 0;
    const severity = distance >= 20 ? "critical" : "warning";

    // ── Task 6: push to the Telegram alerts group ──
    const tg = await getTelegramConfig();
    let telegramSent = false;
    if (tg.botToken && tg.alertsChatId) {
      const paramLabel = paramLabelHuman(param);
      const boundLabel = bound === "upper" ? "أعلى من الحد الأقصى" : "أقل من الحد الأدنى";
      const text =
        `🚨 <b>تنبيه طبي${severity === "critical" ? " حرِج" : ""}</b>\n` +
        `👤 المريض: <b>${escapeHtml(patientName)}</b>\n` +
        `📊 القراءة: ${paramLabel} = <b>${value}</b>\n` +
        `⚠️ ${boundLabel} (${crossedValue})\n` +
        `🕐 ${new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}`;
      const r = await sendTelegramMessage(tg.botToken, tg.alertsChatId, text);
      telegramSent = r.ok;
    }

    const alert = await db.alert.create({
      data: {
        patientId,
        healthRecordId,
        parameterName: param,
        value: String(value),
        bound,
        thresholdValue: crossedValue,
        severity,
        status: "unread",
        telegramSent,
      },
    });

    created.push({
      id: alert.id,
      parameterName: param,
      value: alert.value,
      bound: alert.bound as "lower" | "upper",
      thresholdValue: alert.thresholdValue ?? 0,
      severity: alert.severity,
      telegramSent,
    });
  }

  return created;
}

export function paramLabelHuman(param: string): string {
  switch (param) {
    case "bp_systolic":
      return "ضغط الدم الانقباضي";
    case "bp_diastolic":
      return "ضغط الدم الانبساطي";
    case "heart_rate":
      return "نبضات القلب";
    default:
      return param;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
