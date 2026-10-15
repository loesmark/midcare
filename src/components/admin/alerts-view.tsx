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
import { RefreshCw, ChevronRight, ChevronLeft, Bell, CheckCircle2, Check } from "lucide-react";

interface Alert {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string | null;
  parameter_name: string;
  value: string;
  bound: string | null;
  threshold_value: number | null;
  severity: string;
  status: string;
  telegram_sent: boolean;
  created_at: string;
}

export default function AlertsView({ onChanged }: { onChanged: () => void }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("unread");
  const [severity, setSeverity] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const q = new URLSearchParams({ page: String(page), limit: "25" });
      if (status) q.set("status", status);
      if (severity) q.set("severity", severity);
      const res = await apiFetch<Alert[]>(`/admin/alerts?${q}`);
      setAlerts(res.data);
      setPagination(res.pagination || null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, status, severity]);

  useEffect(() => {
    load();
  }, [load]);

  async function action(id: string, act: "read" | "resolve") {
    try {
      await apiFetch(`/admin/alerts/${id}/${act}`, { method: "PATCH" });
      load();
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">التنبيهات</h1>
        <p className="text-sm text-slate-400 mt-0.5">التنبيهات المولّدة تلقائياً عند تجاوز العتبات</p>
      </div>

      <Card className="p-4 bg-[#161C28] border-white/8 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">الخطورة</span>
          <Select value={severity || "all"} onValueChange={(v) => { setSeverity(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-32 bg-[#080E1A] border-white/10 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#161C28] border-white/10">
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="critical">حرج</SelectItem>
              <SelectItem value="warning">تحذير</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">الحالة</span>
          <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-32 bg-[#080E1A] border-white/10 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#161C28] border-white/10">
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="unread">غير مقروء</SelectItem>
              <SelectItem value="read">مقروء</SelectItem>
              <SelectItem value="resolved">محلول</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-slate-300 mr-auto">
          <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </Card>

      {err && <Card className="p-4 text-sm text-rose-300 bg-rose-500/5 border-rose-500/20">{err}</Card>}

      <Card className="p-0 overflow-hidden bg-[#161C28] border-white/8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-slate-400 text-xs">
                <th className="text-right font-medium p-3">المريض</th>
                <th className="text-right font-medium p-3">القياس</th>
                <th className="text-right font-medium p-3">القيمة</th>
                <th className="text-right font-medium p-3">الحد المتجاوز</th>
                <th className="text-right font-medium p-3">الخطورة</th>
                <th className="text-right font-medium p-3">الحالة</th>
                <th className="text-right font-medium p-3">تيليجرام</th>
                <th className="text-right font-medium p-3">التاريخ</th>
                <th className="text-right font-medium p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && alerts.length === 0 ? (
                <tr><td colSpan={9} className="p-10 text-center text-slate-500">جارٍ التحميل…</td></tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <Bell className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">لا توجد تنبيهات مطابقة.</p>
                    <p className="text-slate-600 text-xs mt-1">
                      تُنشأ التنبيهات تلقائياً عند تجاوز قراءة لمريضٍ ما لعتبة نشطة.
                    </p>
                  </td>
                </tr>
              ) : (
                alerts.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">
                          {initials(a.patient_name)}
                        </span>
                        <span className="font-medium text-white text-xs">{a.patient_name}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-300">{paramLabel(a.parameter_name)}</td>
                    <td className="p-3 font-mono text-xs text-white font-bold" dir="ltr">{a.value}</td>
                    <td className="p-3 text-xs">
                      {a.bound ? (
                        <span className="text-slate-300">
                          {a.bound === "upper" ? "أعلى من" : "أقل من"}{" "}
                          <span className="font-mono text-rose-300">{a.threshold_value}</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      {a.severity === "critical" ? (
                        <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/15">حرج</Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/15">تحذير</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {a.status === "unread" ? (
                        <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/15">غير مقروء</Badge>
                      ) : a.status === "read" ? (
                        <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/30 hover:bg-slate-500/15">مقروء</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15">محلول</Badge>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {a.telegram_sent ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-400">{relativeTime(a.created_at)}</td>
                    <td className="p-3">
                      {a.status !== "resolved" ? (
                        <div className="flex gap-1 justify-end">
                          {a.status === "unread" && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-300" onClick={() => action(a.id, "read")}>
                              <Check className="w-3.5 h-3.5 ml-1" /> مقروء
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-300 hover:bg-emerald-500/10" onClick={() => action(a.id, "resolve")}>
                            <CheckCircle2 className="w-3.5 h-3.5 ml-1" /> حل
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="p-3 flex items-center justify-between border-t border-white/8">
            <div className="text-xs text-slate-500">
              صفحة {pagination.page} من {pagination.total_pages} · {pagination.total} تنبيه
            </div>
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

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("");
}
function relativeTime(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} ي`;
}
function paramLabel(p: string) {
  switch (p) {
    case "bp_systolic": return "ضغط انقباضي";
    case "bp_diastolic": return "ضغط انبساطي";
    case "heart_rate": return "نبض القلب";
    default: return p;
  }
}
