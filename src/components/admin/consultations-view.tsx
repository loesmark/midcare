"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, type Pagination } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, ChevronRight, ChevronLeft, Stethoscope, Send } from "lucide-react";

interface Consultation {
  id: string;
  patient_id: string;
  patient_name: string;
  category: string;
  type_id: string | null;
  custom_type: string | null;
  reason: string;
  symptoms: { name: string; is_critical?: boolean }[];
  custom_symptom_text: string | null;
  context: {
    latest_reading: {
      id: string;
      bp_systolic: number | null;
      bp_diastolic: number | null;
      heart_rate: number | null;
      notes: string | null;
      created_at: string;
    } | null;
    reading_freshness: "fresh" | "old" | "none";
    attachments?: any[];
  } | null;
  status: string;
  notes: string | null;
  doctor_response: {
    response_text: string | null;
    recommended_action: string | null;
    follow_up_date: string | null;
    responded_at?: string;
  } | null;
  whatsapp_link: string | null;
  created_at: string;
  responded_at: string | null;
}

export default function ConsultationsView() {
  const [rows, setRows] = useState<Consultation[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [respond, setRespond] = useState<Consultation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const q = new URLSearchParams({ page: String(page), limit: "25" });
      if (status) q.set("status", status);
      const res = await apiFetch<Consultation[]>(`/admin/consultations?${q}`);
      setRows(res.data);
      setPagination(res.pagination || null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">الاستشارات</h1>
        <p className="text-sm text-slate-400 mt-0.5">استشارات المرضى — عاجلة ودورية</p>
      </div>

      <Card className="p-4 bg-[#161C28] border-white/8 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">الحالة</span>
          <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-36 bg-[#080E1A] border-white/10 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#161C28] border-white/10">
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="responded">تم الرد</SelectItem>
              <SelectItem value="closed">مغلقة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-slate-300 mr-auto">
          <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} /> تحديث
        </Button>
      </Card>

      {err && <Card className="p-4 text-sm text-rose-300 bg-rose-500/5 border-rose-500/20">{err}</Card>}

      <Card className="p-0 overflow-hidden bg-[#161C28] border-white/8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-slate-400 text-xs">
                <th className="text-right font-medium p-3">المريض</th>
                <th className="text-right font-medium p-3">الفئة</th>
                <th className="text-right font-medium p-3">السبب</th>
                <th className="text-right font-medium p-3">الحالة</th>
                <th className="text-right font-medium p-3">التاريخ</th>
                <th className="text-right font-medium p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-500">جارٍ التحميل…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Stethoscope className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">لا توجد استشارات مطابقة.</p>
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">
                          {initials(c.patient_name)}
                        </span>
                        <span className="font-medium text-white text-xs">{c.patient_name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {c.category === "immediate" ? (
                        <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/15">عاجلة</Badge>
                      ) : (
                        <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/15">دورية</Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-300 max-w-[300px] truncate">{c.reason}</td>
                    <td className="p-3">
                      {c.status === "pending" ? (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/15">قيد الانتظار</Badge>
                      ) : c.status === "responded" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15">تم الرد</Badge>
                      ) : (
                        <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/30 hover:bg-slate-500/15">مغلقة</Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-400">{relativeTime(c.created_at)}</td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm" className="text-teal-300" onClick={() => setRespond(c)}>
                        {c.status === "pending" ? "رد" : "عرض"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination && (
          <div className="p-3 flex items-center justify-between border-t border-white/8">
            <div className="text-xs text-slate-500">صفحة {pagination.page} من {pagination.total_pages} · {pagination.total} استشارة</div>
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

      {respond && <RespondDialog consult={respond} onClose={() => setRespond(null)} onSaved={() => { setRespond(null); load(); }} />}
    </div>
  );
}

function RespondDialog({ consult, onClose, onSaved }: { consult: Consultation; onClose: () => void; onSaved: () => void }) {
  const [responseText, setResponseText] = useState(consult.doctor_response?.response_text || "");
  const [action, setAction] = useState(consult.doctor_response?.recommended_action || "");
  const [followUp, setFollowUp] = useState(consult.doctor_response?.follow_up_date || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    setSaving(true);
    setErr("");
    try {
      await apiFetch(`/admin/consultations/${consult.id}/respond`, {
        method: "PATCH",
        body: { response_text: responseText, recommended_action: action, follow_up_date: followUp || undefined },
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Render selected symptoms + custom symptom text + latest reading footnote
  // so the doctor has full context while writing the response.
  const ctx = consult.context;
  const latestReading = ctx?.latest_reading;
  const freshnessLabel =
    ctx?.reading_freshness === "fresh"
      ? "أحدث قراءة (خلال 24 ساعة)"
      : ctx?.reading_freshness === "old"
      ? "آخر قراءة قديمة"
      : "لا توجد قراءات سابقة";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#161C28] border-white/10 text-slate-200 max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white">استشارة — {consult.patient_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-[#080E1A] border border-white/5 rounded-lg p-3 text-xs space-y-2">
            <div className="flex gap-2 items-center">
              <span className="text-slate-500 shrink-0">الفئة:</span>
              <span>{consult.category === "immediate" ? "عاجلة" : "دورية"}</span>
              <span className="text-slate-500 mx-2">·</span>
              <span className="text-slate-500 shrink-0">النوع:</span>
              <span className="text-slate-200">{consult.custom_type || "—"}</span>
            </div>
            <div><span className="text-slate-500">السبب:</span> {consult.reason}</div>
            {Array.isArray(consult.symptoms) && consult.symptoms.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center pt-1">
                <span className="text-slate-500">الأعراض:</span>
                {consult.symptoms.map((s, i) => (
                  <span
                    key={i}
                    className={`px-2 py-0.5 rounded-full text-[10px] border ${
                      s.is_critical
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        : "bg-sky-500/15 text-sky-300 border-sky-500/30"
                    }`}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            )}
            {consult.custom_symptom_text && (
              <div>
                <span className="text-slate-500">وصف إضافي للأعراض:</span>
                <div className="mt-1 text-slate-300 whitespace-pre-wrap">{consult.custom_symptom_text}</div>
              </div>
            )}
            {latestReading && (
              <div className="pt-1 border-t border-white/5 mt-2">
                <div className="text-slate-500 mb-1">{freshnessLabel}:</div>
                <div className="font-mono text-slate-200" dir="ltr">
                  {latestReading.bp_systolic ?? "-"}/{latestReading.bp_diastolic ?? "-"} mmHg · {latestReading.heart_rate ?? "-"} BPM
                </div>
              </div>
            )}
            {consult.notes && !consult.doctor_response && (
              <div><span className="text-slate-500">ملاحظات سابقة:</span> {consult.notes}</div>
            )}
            {consult.doctor_response && (
              <div className="pt-1 border-t border-white/5 mt-2">
                <div className="text-slate-500 mb-1">الرد السابق:</div>
                {consult.doctor_response.response_text && (
                  <div className="text-slate-200">{consult.doctor_response.response_text}</div>
                )}
              </div>
            )}
            {consult.whatsapp_link && (
              <a href={consult.whatsapp_link} target="_blank" rel="noopener" className="inline-block text-emerald-400 hover:underline">
                فتح محادثة واتساب ↗
              </a>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">نص الرد</Label>
            <Textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={3} placeholder="ردك على المريض…" className="bg-[#080E1A] border-white/10 text-white resize-none" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">الإجراء الموصى به</Label>
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="مثال: زيادة جرعة الدواء" className="bg-[#080E1A] border-white/10 text-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">موعد المتابعة</Label>
            <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="bg-[#080E1A] border-white/10 text-white" />
          </div>
          {err && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{err}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-300">إلغاء</Button>
          <Button onClick={send} disabled={saving} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white">
            <Send className="w-4 h-4 ml-1" /> إرسال الرد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function initials(name: string) { return name.split(" ").map((s) => s[0]).slice(0, 2).join(""); }
function relativeTime(s: string) {
  const d = Date.now() - new Date(s).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.floor(h / 24)} ي`;
}
