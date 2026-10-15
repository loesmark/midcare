"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, type Pagination } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Check,
  X,
  Phone,
  MessageCircle,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Info,
} from "lucide-react";
import { toast } from "sonner";

type Range = "today" | "week" | "month" | "all";

interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string | null;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  notes: string | null;
  whatsapp_link: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export default function AppointmentsView() {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [range, setRange] = useState<Range>("today"); // default to "today" — doctor's main use case
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const q = new URLSearchParams({ page: String(page), limit: "25" });
      if (status) q.set("status", status);
      if (range !== "all") q.set("range", range);
      const res = await apiFetch<Appointment[]>(`/admin/appointments?${q}`);
      setRows(res.data);
      setPagination(res.pagination || null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, status, range]);

  useEffect(() => { load(); }, [load]);

  async function action(id: string, act: "confirm" | "cancel") {
    try {
      await apiFetch(`/admin/appointments/${id}/${act}`, { method: "PATCH" });
      toast.success(act === "confirm" ? "تم تأكيد الموعد — تم إنشاء رابط واتساب." : "تم إلغاء الموعد.");
      load();
    } catch (e: any) {
      toast.error("فشل: " + e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">المواعيد المحجوزة</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          تصفّح المواعيد حسب اليوم / الأسبوع / الشهر، وتواصل مع المريض مباشرة عبر واتساب أو اتصال.
        </p>
      </div>

      {/* Range tabs + status filter + refresh */}
      <Card className="p-4 bg-[#161C28] border-white/8 flex flex-wrap gap-3 items-center">
        {/* Range segmented control */}
        <div className="inline-flex items-center bg-[#080E1A] border border-white/10 rounded-lg p-1 text-xs font-medium">
          <button
            onClick={() => { setRange("today"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              range === "today" ? "bg-gradient-to-l from-teal-500/30 to-emerald-500/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" /> اليوم
          </button>
          <button
            onClick={() => { setRange("week"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              range === "week" ? "bg-gradient-to-l from-teal-500/30 to-emerald-500/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" /> الأسبوع
          </button>
          <button
            onClick={() => { setRange("month"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              range === "month" ? "bg-gradient-to-l from-teal-500/30 to-emerald-500/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> الشهر
          </button>
          <button
            onClick={() => { setRange("all"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              range === "all" ? "bg-gradient-to-l from-teal-500/30 to-emerald-500/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> الكل
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">الحالة</span>
          <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-36 bg-[#080E1A] border-white/10 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#161C28] border-white/10">
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="requested">مطلوب</SelectItem>
              <SelectItem value="confirmed">مؤكد</SelectItem>
              <SelectItem value="cancelled">ملغى</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="sm" onClick={load} className="text-slate-300 mr-auto">
          <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} /> تحديث
        </Button>
      </Card>

      {/* Helper banner — explains how the "تواصل" button works */}
      <Card className="p-3 bg-sky-500/5 border-sky-500/20 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-sky-300 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-300 leading-relaxed">
          زر <span className="text-sky-300 font-semibold">«تواصل»</span> يفتح واتساب برقم المريض مباشرة. إذا أدخل المريض رقمه
          بدون رمز النداء الدولي (مثل <span className="font-mono" dir="ltr">010xxxxxxxx</span>)، فستظهر أيقونة
          <Phone className="inline w-3 h-3 mx-1" /> اتصال محلي بجانبه — اضغط عليها للاتصال عبر تطبيق الهاتف، أو أضف رمز
          النداء يدوياً (مثال: <span className="font-mono" dir="ltr">+20</span> لمصر).
        </div>
      </Card>

      {err && <Card className="p-4 text-sm text-rose-300 bg-rose-500/5 border-rose-500/20">{err}</Card>}

      <Card className="p-0 overflow-hidden bg-[#161C28] border-white/8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-slate-400 text-xs">
                <th className="text-right font-medium p-3">المريض</th>
                <th className="text-right font-medium p-3">رقم الهاتف</th>
                <th className="text-right font-medium p-3">التاريخ</th>
                <th className="text-right font-medium p-3">الوقت</th>
                <th className="text-right font-medium p-3">الحالة</th>
                <th className="text-right font-medium p-3">ملاحظات</th>
                <th className="text-right font-medium p-3">تواصل</th>
                <th className="text-right font-medium p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-slate-500">جارٍ التحميل…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">
                      {range === "today" ? "لا توجد مواعيد اليوم."
                       : range === "week" ? "لا توجد مواعيد هذا الأسبوع."
                       : range === "month" ? "لا توجد مواعيد هذا الشهر."
                       : "لا توجد مواعيد مطابقة."}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">
                          {initials(a.patient_name)}
                        </span>
                        <span className="font-medium text-white text-xs">{a.patient_name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <PhoneCell phone={a.patient_phone} />
                    </td>
                    <td className="p-3 text-white text-xs">{fmtDate(a.scheduled_date)}</td>
                    <td className="p-3 font-mono text-xs" dir="ltr">{a.scheduled_time}</td>
                    <td className="p-3">{statusBadge(a.status)}</td>
                    <td className="p-3 text-xs text-slate-400 max-w-[200px] truncate" title={a.notes || ""}>{a.notes || "—"}</td>
                    <td className="p-3">
                      <ContactButtons
                        phone={a.patient_phone}
                        patientName={a.patient_name}
                        whatsappLink={a.whatsapp_link}
                      />
                    </td>
                    <td className="p-3">
                      {a.status === "requested" ? (
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-300 hover:bg-emerald-500/10" onClick={() => action(a.id, "confirm")}>
                            <Check className="w-3.5 h-3.5 ml-1" /> تأكيد
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-300 hover:bg-rose-500/10" onClick={() => action(a.id, "cancel")}>
                            <X className="w-3.5 h-3.5 ml-1" /> إلغاء
                          </Button>
                        </div>
                      ) : a.status === "confirmed" ? (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-300 hover:bg-rose-500/10" onClick={() => action(a.id, "cancel")}>
                          <X className="w-3.5 h-3.5 ml-1" /> إلغاء
                        </Button>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination && (
          <div className="p-3 flex items-center justify-between border-t border-white/8">
            <div className="text-xs text-slate-500">صفحة {pagination.page} من {pagination.total_pages} · {pagination.total} موعد</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!pagination.has_prev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronRight className="w-4 h-4" /> السابق
              </Button>
              <Button variant="outline" size="sm" disabled={!pagination.has_next} onClick={() => setPage((p) => p + 1)}>
                التالي <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Display the patient's phone number with a tooltip explaining whether
 *  it has a country code or not. */
function PhoneCell({ phone }: { phone: string | null }) {
  if (!phone) {
    return <span className="text-slate-600 text-xs">—</span>;
  }
  const digits = phone.replace(/[^\d]/g, "");
  const hasCountryCode = digits.length > 10 && digits.startsWith("0") === false;
  // Heuristic: Egyptian local numbers start with "01" and have 11 digits.
  // International format usually starts with the country code (e.g. "20" for Egypt).
  const looksLocal = /^0\d{9,12}$/.test(digits);

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs text-slate-200" dir="ltr">{phone}</span>
      {looksLocal && (
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30"
          title="الرقم بدون رمز النداء الدولي — أضف الرمز يدوياً عند الحاجة (مثال: +20 لمصر)"
        >
          محلي
        </span>
      )}
      {hasCountryCode && (
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
          title="الرقم يحتوي رمز النداء الدولي — جاهز للاستخدام في واتساب"
        >
          دولي
        </span>
      )}
    </div>
  );
}

/** Smart contact buttons:
 *  - WhatsApp button → opens wa.me with the patient's phone (if it has a
 *    country code) OR shows a tooltip warning the doctor to add the country
 *    code manually.
 *  - Phone button → opens `tel:` for a local-call fallback (always available
 *    on mobile devices; on desktop it triggers the system dialer).
 *  - If the appointment already has a `whatsapp_link` (set when the doctor
 *    confirmed it earlier with a pre-filled message), we prefer that link
 *    because it includes the appointment confirmation message. */
function ContactButtons({
  phone,
  patientName,
  whatsappLink,
}: {
  phone: string | null;
  patientName: string;
  whatsappLink: string | null;
}) {
  if (!phone) {
    return <span className="text-slate-600 text-xs">لا يوجد رقم</span>;
  }

  const digits = phone.replace(/[^\d]/g, "");
  const looksLocal = /^0\d{9,12}$/.test(digits);
  // For wa.me we need the digits WITHOUT a leading "0" — Telegram/WhatsApp
  // convention is country-code-first. If the number already has a country
  // code (no leading zero, length > 10), we use it as-is.
  const waDigits = looksLocal ? digits.replace(/^0/, "") : digits;
  const waLink = whatsappLink || `https://wa.me/${waDigits}`;

  return (
    <div className="flex items-center gap-1.5">
      {/* WhatsApp button */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-emerald-300 border border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition"
        title={looksLocal
          ? `افتح واتساب — ملاحظة: الرقم محلي (${phone}). أضف رمز النداء (مثال: 20 لمصر) في واتساب.`
          : `افتح واتساب برقم ${patientName}`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        واتساب
      </a>

      {/* tel: link — always works for local numbers, even without country code */}
      <a
        href={`tel:${phone}`}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-sky-300 border border-sky-400/30 bg-sky-500/10 hover:bg-sky-500/20 transition"
        title={`اتصال هاتفي بـ ${phone}`}
      >
        <Phone className="w-3.5 h-3.5" />
      </a>

      {/* If the number looks local, show a small warning chip */}
      {looksLocal && (
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap"
          title="الرقم بدون رمز نداء دولي — لتعمل واتساب أضف الرمز (مثال: 20 لمصر) قبل الرقم"
        >
          ⚠ أضف النداء
        </span>
      )}
    </div>
  );
}

function statusBadge(s: string) {
  const map: Record<string, { cls: string; label: string }> = {
    requested: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", label: "مطلوب" },
    confirmed: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "مؤكد" },
    cancelled: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/30", label: "ملغى" },
    completed: { cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", label: "مكتمل" },
  };
  const v = map[s] || map.requested;
  return <Badge className={`${v.cls} hover:${v.cls}`}>{v.label}</Badge>;
}

function initials(name: string) { return name.split(" ").map((s) => s[0]).slice(0, 2).join(""); }
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return s; }
}
