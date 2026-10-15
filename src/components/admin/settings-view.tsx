"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Send,
  Save,
  Image as ImageIcon,
  Bell,
  MessageCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  ExternalLink,
} from "lucide-react";

interface Settings {
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_alerts_chat_id: string;
  doctor_whatsapp: string;
}

/** Result envelope returned by all three Telegram test endpoints. The
 *  endpoints always return HTTP 200 with `success: true` (the standard
 *  API envelope); the *test* outcome is encoded in `data.ok`. This lets us
 *  show precise error messages instead of an ApiError toast. */
interface TestResult {
  ok: boolean;
  sent_at?: string;
  chat_id?: string | null;
  message_id?: number | null;
  phone?: string | null;
  link?: string | null;
  telegram_response?: string;
  error_code?: string;
  error_message?: string;
  hint?: string;
}

type TestKind = "image" | "alert" | "whatsapp";

/** Save response — includes the keys that actually changed so the UI can
 *  render a diff preview. */
interface SaveResult {
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_alerts_chat_id: string;
  doctor_whatsapp: string;
  changed_keys?: string[];
  changed_count?: number;
}

export default function SettingsView() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string>(""); // "" | "image" | "alert" | "whatsapp"
  const [lastResult, setLastResult] = useState<{ kind: TestKind; data: TestResult } | null>(null);
  const [saveSummary, setSaveSummary] = useState<{ changed: string[]; at: string } | null>(null);

  useEffect(() => {
    apiFetch<Settings>("/admin/settings")
      .then((r) => setS(r.data))
      .catch((e) => toast.error("فشل تحميل الإعدادات: " + e.message));
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    setSaveSummary(null);
    try {
      const r = await apiFetch<SaveResult>("/admin/settings", { method: "PUT", body: s });
      // Sync the local state with the server's snapshot.
      setS({
        telegram_bot_token: r.data.telegram_bot_token,
        telegram_chat_id: r.data.telegram_chat_id,
        telegram_alerts_chat_id: r.data.telegram_alerts_chat_id,
        doctor_whatsapp: r.data.doctor_whatsapp,
      });
      const changed = r.data.changed_keys ?? [];
      if (changed.length > 0) {
        setSaveSummary({ changed, at: new Date().toLocaleTimeString("ar-EG") });
        toast.success(`تم حفظ الإعدادات — ${changed.length} حقل تغيّر.`);
      } else {
        toast.info("لا توجد تغييرات — الإعدادات محدّثة مسبقاً.");
      }
    } catch (e: any) {
      toast.error("فشل الحفظ: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function runTest(kind: TestKind) {
    setTesting(kind);
    setLastResult(null);
    try {
      const path =
        kind === "image" ? "/admin/settings/test-image-group"
        : kind === "alert" ? "/admin/settings/test-alert-group"
        : "/admin/settings/test-whatsapp";
      const r = await apiFetch<TestResult>(path, { method: "POST" });
      setLastResult({ kind, data: r.data });
      // Also pop a quick toast — the detailed banner below shows the full info.
      if (r.data.ok) {
        toast.success(
          kind === "image" ? "✅ نجح اختبار مجموعة الصور"
          : kind === "alert" ? "✅ نجح اختبار مجموعة التنبيهات"
          : "✅ تم التحقق من رقم واتساب"
        );
      } else {
        toast.error(`❌ فشل الاختبار: ${r.data.error_message || "خطأ غير معروف"}`);
      }
    } catch (e: any) {
      // Network-level error (server unreachable, 500, etc.).
      setLastResult({
        kind,
        data: {
          ok: false,
          error_code: "NETWORK_ERROR",
          error_message: e.message || "تعذر الوصول للخادم.",
        },
      });
      toast.error("فشل الاتصال: " + e.message);
    } finally {
      setTesting("");
    }
  }

  if (!s) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">الإعدادات</h1>
        <p className="text-sm text-slate-400 mt-0.5">إعدادات تيليجرام وواتساب</p>
      </div>

      {/* Save summary banner — shows what changed after a successful save */}
      {saveSummary && (
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs">
            <div className="text-emerald-300 font-semibold mb-1">تم الحفظ — {saveSummary.changed.length} حقل تغيّر</div>
            <div className="flex flex-wrap gap-1.5">
              {saveSummary.changed.map((k) => (
                <span key={k} className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  {k}
                </span>
              ))}
            </div>
            <div className="text-slate-500 mt-1.5">الوقت: {saveSummary.at}</div>
          </div>
          <button
            onClick={() => setSaveSummary(null)}
            className="text-slate-500 hover:text-slate-300"
            aria-label="إغلاق"
          >×</button>
        </Card>
      )}

      {/* Telegram & WhatsApp card */}
      <Card className="p-5 bg-[#161C28] border-white/8 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Send className="w-4 h-4 text-teal-300" /> تيليجرام وواتساب
        </h3>

        <div className="space-y-3">
          <Field label="Bot Token" mono>
            <Input
              type="password"
              value={s.telegram_bot_token}
              onChange={(e) => setS({ ...s, telegram_bot_token: e.target.value })}
              placeholder="123456789:ABCdef…"
              className="bg-[#080E1A] border-white/10 text-white font-mono text-xs"
              dir="ltr"
            />
          </Field>

          <Field label="معرّف مجموعة الصور (تخزين الملفات)" hint="ترفع هنا صور وملفات المرضى">
            <Input
              value={s.telegram_chat_id}
              onChange={(e) => setS({ ...s, telegram_chat_id: e.target.value })}
              placeholder="-1001234567890"
              className="bg-[#080E1A] border-white/10 text-white font-mono text-xs"
              dir="ltr"
            />
          </Field>

          <Field label="معرّف مجموعة التنبيهات (منفصلة)" hint="تُرسل هنا التنبيهات الطبية الحرجة تلقائياً">
            <Input
              value={s.telegram_alerts_chat_id}
              onChange={(e) => setS({ ...s, telegram_alerts_chat_id: e.target.value })}
              placeholder="-1009876543210"
              className="bg-[#080E1A] border-white/10 text-white font-mono text-xs"
              dir="ltr"
            />
          </Field>

          <Field label="رقم واتساب الطبيب" hint="لإنشاء روابط المحادثة">
            <Input
              value={s.doctor_whatsapp}
              onChange={(e) => setS({ ...s, doctor_whatsapp: e.target.value })}
              placeholder="201000000000"
              className="bg-[#080E1A] border-white/10 text-white font-mono text-xs"
              dir="ltr"
            />
          </Field>
        </div>

        <div className="flex justify-end pt-2 border-t border-white/8">
          <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
            حفظ الإعدادات
          </Button>
        </div>
      </Card>

      {/* Test buttons */}
      <Card className="p-5 bg-[#161C28] border-white/8 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">أزرار الاختبار</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            تستخدم هذه الأزرار <span className="text-teal-300">القيم المحفوظة</span> مباشرةً — احفظ الإعدادات أولاً ثم اضغط للاختبار.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Image group */}
          <button
            onClick={() => runTest("image")}
            disabled={testing !== ""}
            className="flex flex-col items-start gap-2 p-4 rounded-xl border border-white/8 bg-[#080E1A] hover:border-teal-400/40 hover:bg-white/5 transition text-right disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-lg bg-teal-500/15 flex items-center justify-center">
              {testing === "image" ? <Loader2 className="w-4 h-4 text-teal-300 animate-spin" /> : <ImageIcon className="w-4 h-4 text-teal-300" />}
            </div>
            <div className="text-sm font-medium text-white">اختبار مجموعة الصور</div>
            <div className="text-[11px] text-slate-400">يرسل رسالة لمجموعة تخزين الملفات</div>
          </button>

          {/* Alert group */}
          <button
            onClick={() => runTest("alert")}
            disabled={testing !== ""}
            className="flex flex-col items-start gap-2 p-4 rounded-xl border border-rose-400/20 bg-rose-500/5 hover:border-rose-400/50 hover:bg-rose-500/10 transition text-right disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-lg bg-rose-500/15 flex items-center justify-center">
              {testing === "alert" ? <Loader2 className="w-4 h-4 text-rose-300 animate-spin" /> : <Bell className="w-4 h-4 text-rose-300" />}
            </div>
            <div className="text-sm font-medium text-white">اختبار مجموعة التنبيهات</div>
            <div className="text-[11px] text-slate-400">يرسل رسالة لمجموعة التنبيهات الطبية</div>
          </button>

          {/* WhatsApp */}
          <button
            onClick={() => runTest("whatsapp")}
            disabled={testing !== ""}
            className="flex flex-col items-start gap-2 p-4 rounded-xl border border-emerald-400/20 bg-emerald-500/5 hover:border-emerald-400/50 hover:bg-emerald-500/10 transition text-right disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              {testing === "whatsapp" ? <Loader2 className="w-4 h-4 text-emerald-300 animate-spin" /> : <MessageCircle className="w-4 h-4 text-emerald-300" />}
            </div>
            <div className="text-sm font-medium text-white">اختبار واتساب</div>
            <div className="text-[11px] text-slate-400">يتحقق من الرقم وينشئ رابط المحادثة</div>
          </button>
        </div>

        {/* Result banner — distinct success/error/info styling based on data.ok */}
        {lastResult && (
          <TestResultBanner kind={lastResult.kind} data={lastResult.data} onDismiss={() => setLastResult(null)} />
        )}
      </Card>
    </div>
  );
}

/** Distinct, color-coded banner that shows the full structured test result:
 *  - success → green banner with chat_id + message_id + sent_at
 *  - failure → red banner with error_code + error_message + hint
 *  This replaces the previous single-line `toast.error("فشل الاختبار: …")`
 *  that gave the admin no actionable detail. */
function TestResultBanner({
  kind,
  data,
  onDismiss,
}: {
  kind: TestKind;
  data: TestResult;
  onDismiss: () => void;
}) {
  const kindLabel =
    kind === "image" ? "مجموعة الصور"
    : kind === "alert" ? "مجموعة التنبيهات"
    : "واتساب";

  if (data.ok) {
    return (
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
        <div className="flex-1 text-xs space-y-1.5">
          <div className="text-emerald-300 font-semibold">
            نجح اختبار {kindLabel}
          </div>
          {data.sent_at && (
            <div className="text-slate-400">وقت الإرسال: <span className="font-mono" dir="ltr">{data.sent_at}</span></div>
          )}
          {data.chat_id && (
            <div className="text-slate-400">معرّف المحادثة: <span className="font-mono text-slate-200" dir="ltr">{data.chat_id}</span></div>
          )}
          {typeof data.message_id === "number" && (
            <div className="text-slate-400">معرّف الرسالة: <span className="font-mono text-slate-200" dir="ltr">{data.message_id}</span></div>
          )}
          {data.telegram_response && (
            <div className="text-slate-300">{data.telegram_response}</div>
          )}
          {data.link && (
            <a href={data.link} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-emerald-300 hover:underline font-mono">
              {data.link} <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {data.hint && (
            <div className="text-slate-400 italic">{data.hint}</div>
          )}
        </div>
        <button onClick={onDismiss} className="text-slate-500 hover:text-slate-300" aria-label="إغلاق">×</button>
      </div>
    );
  }

  // Failure case — show error_code + error_message + hint in red.
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
      <XCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
      <div className="flex-1 text-xs space-y-1.5">
        <div className="text-rose-300 font-semibold">
          فشل اختبار {kindLabel}
        </div>
        {data.error_code && (
          <div className="text-slate-400">
            رمز الخطأ: <span className="font-mono text-rose-300" dir="ltr">{data.error_code}</span>
          </div>
        )}
        {data.error_message && (
          <div className="text-slate-200">{data.error_message}</div>
        )}
        {data.hint && (
          <div className="flex items-start gap-1.5 text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 mt-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{data.hint}</span>
          </div>
        )}
      </div>
      <button onClick={onDismiss} className="text-slate-500 hover:text-slate-300" aria-label="إغلاق">×</button>
    </div>
  );
}

function Field({
  label,
  hint,
  mono,
  children,
}: {
  label: string;
  hint?: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-slate-400">{label}</Label>
        {hint && <span className="text-[10px] text-slate-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
