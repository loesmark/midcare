"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, getToken, type Pagination } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import Lightbox, { type LightboxItem } from "./lightbox";
import {
  Search,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Plus,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface Patient {
  user_id: string;
  id: string;
  name: string;
  phone_number: string;
  status: string;
  created_at: string;
  birth_date: string | null;
  smoking_status: string | null;
}

interface Attachment {
  type: "local" | "telegram";
  url?: string;
  fileId?: string;
  fileName: string;
  isImage: boolean;
}

interface Record {
  id: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  current_medications: string | null;
  notes: string | null;
  attachments: Attachment[];
  created_at: string;
}

export default function PatientsView() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const q = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) q.set("search", search);
      const res = await apiFetch<Patient[]>(`/admin/patients?${q}`);
      setPatients(res.data);
      setPagination(res.pagination || null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  if (selected) {
    return <PatientDetail patient={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">المرضى</h1>
          <p className="text-sm text-slate-400 mt-0.5">إدارة ومتابعة المرضى المسجّلين</p>
        </div>
      </div>

      <Card className="p-4 bg-[#161C28] border-white/8 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="ابحث بالاسم أو رقم الهاتف…"
            className="bg-[#080E1A] border-white/10 text-white placeholder:text-slate-600 pr-9 text-right"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-slate-300">
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
                <th className="text-right font-medium p-3">الهاتف</th>
                <th className="text-right font-medium p-3">الحالة</th>
                <th className="text-right font-medium p-3">تاريخ التسجيل</th>
                <th className="text-right font-medium p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && patients.length === 0 ? (
                <SkeletonRows cols={5} />
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    لا يوجد مرضى.
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr
                    key={p.user_id}
                    onClick={() => setSelected(p)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-white">
                          {initials(p.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">#{p.user_id.slice(-8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-300" dir="ltr">
                      {p.phone_number}
                    </td>
                    <td className="p-3">
                      {p.status === "active" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15">
                          نشط
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/15">
                          موقوف
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-400">{fmtDate(p.created_at)}</td>
                    <td className="p-3 text-left">
                      <Button variant="ghost" size="sm" className="text-teal-300">
                        عرض <ChevronLeft className="w-4 h-4" />
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
            <div className="text-xs text-slate-500">
              صفحة {pagination.page} من {pagination.total_pages} · {pagination.total} مريض
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_prev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="w-4 h-4" /> السابق
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_next}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function PatientDetail({ patient, onBack }: { patient: Patient; onBack: () => void }) {
  const [records, setRecords] = useState<Record[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "10" });
      const res = await apiFetch<Record[]>(`/admin/patients/${patient.user_id}/records?${q}`);
      setRecords(res.data);
      setPagination(res.pagination || null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [patient.user_id, page]);

  useEffect(() => {
    load();
  }, [load]);

  // collect all image attachments across records for the lightbox
  function openLightbox(recordIdx: number, attachIdx: number) {
    const items: LightboxItem[] = [];
    const token = encodeURIComponent(getToken() || "");
    records.forEach((r) => {
      r.attachments.forEach((a) => {
        const url = a.type === "local" ? a.url || "" : `/api/v1/admin/telegram-file/${a.fileId}?t=${token}`;
        items.push({ url, fileName: a.fileName, isImage: a.isImage });
      });
    });
    // map record+attach index to flat index
    let flat = 0;
    for (let i = 0; i <= recordIdx; i++) {
      const atts = records[i].attachments;
      if (i === recordIdx) {
        flat += attachIdx;
        break;
      }
      flat += atts.length;
    }
    setLightbox({ items, index: flat });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-300">
          <ArrowRight className="w-4 h-4 ml-1" /> رجوع
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-sm font-bold text-white">
            {initials(patient.name)}
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{patient.name}</h1>
            <div className="text-xs text-slate-400 font-mono" dir="ltr">
              {patient.phone_number}
            </div>
          </div>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
        >
          <Plus className="w-4 h-4 ml-1" /> إضافة قراءة
        </Button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <InfoCard label="تاريخ الميلاد" value={patient.birth_date ? fmtDate(patient.birth_date) : "—"} />
        <InfoCard label="العمر" value={patient.birth_date ? ageFromBirth(patient.birth_date) + " سنة" : "—"} />
        <InfoCard label="التدخين" value={smokingLabel(patient.smoking_status)} />
        <InfoCard label="الحالة" value={patient.status === "active" ? "نشط" : "موقوف"} />
      </div>

      {/* Records */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">السجلات الصحية</h2>
        {loading && records.length === 0 ? (
          <Card className="p-8 bg-[#161C28] border-white/8 text-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </Card>
        ) : records.length === 0 ? (
          <Card className="p-8 bg-[#161C28] border-white/8 text-center text-slate-500">
            لا توجد سجلات صحية لهذا المريض بعد.
          </Card>
        ) : (
          <div className="space-y-3">
            {records.map((r, ri) => (
              <Card key={r.id} className="p-4 bg-[#161C28] border-white/8">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div className="text-xs text-slate-400">
                    {fmtDateTime(r.created_at)} · {relativeTime(r.created_at)}
                  </div>
                  <Badge className="bg-white/5 text-slate-300 border-white/10 hover:bg-white/5">
                    <Paperclip className="w-3 h-3 ml-1" />
                    {r.attachments.length} مرفق
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <Reading label="الضغط" value={r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : "—"} />
                  <Reading label="النبض" value={r.heart_rate != null ? String(r.heart_rate) : "—"} />
                  <Reading label="الأدوية" value={r.current_medications || "—"} />
                </div>

                {r.notes && (
                  <div className="text-xs text-slate-300 bg-[#080E1A] border border-white/5 rounded-lg p-2.5 mb-3">
                    {r.notes}
                  </div>
                )}

                {/* Task 8: image thumbnails + lightbox */}
                {r.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.attachments.map((a, ai) => {
                      const url =
                        a.type === "local"
                          ? a.url || ""
                          : `/api/v1/admin/telegram-file/${a.fileId}?t=${encodeURIComponent(getToken() || "")}`;
                      return (
                        <button
                          key={ai}
                          onClick={() => openLightbox(ri, ai)}
                          className="group relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 hover:border-teal-400/50 transition bg-[#080E1A]"
                          title={a.fileName}
                        >
                          {a.isImage ? (
                            <img
                              src={url}
                              alt={a.fileName}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                              <FileText className="w-6 h-6" />
                              <span className="text-[9px] mt-1 truncate w-full text-center px-1">
                                {a.fileName}
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {pagination && (
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              صفحة {pagination.page} من {pagination.total_pages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_prev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="w-4 h-4" /> السابق
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_next}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add reading dialog */}
      <AddReadingDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setLastResult(null);
        }}
        patient={patient}
        onSaved={() => {
          load();
        }}
        lastResult={lastResult}
        setLastResult={setLastResult}
      />

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(i) => setLightbox({ ...lightbox, index: i })}
        />
      )}
    </div>
  );
}

function AddReadingDialog({
  open,
  onOpenChange,
  patient,
  onSaved,
  lastResult,
  setLastResult,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patient: Patient;
  onSaved: () => void;
  lastResult: any;
  setLastResult: (r: any) => void;
}) {
  const [bpS, setBpS] = useState("");
  const [bpD, setBpD] = useState("");
  const [hr, setHr] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true);
    setErr("");
    setLastResult(null);
    try {
      const fd = new FormData();
      if (bpS) fd.append("bp_systolic", bpS);
      if (bpD) fd.append("bp_diastolic", bpD);
      if (hr) fd.append("heart_rate", hr);
      if (notes) fd.append("notes", notes);
      files.forEach((f) => fd.append("files", f));
      const res = await apiFetch<{
        record: any;
        alerts_generated: any[];
        alerts_count: number;
      }>(`/admin/patients/${patient.user_id}/add-reading`, { method: "POST", body: fd });
      setLastResult(res.data);
      onSaved();
      // reset
      setBpS(""); setBpD(""); setHr(""); setNotes(""); setFiles([]);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#161C28] border-white/10 text-slate-200 max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white">إضافة قراءة جديدة — {patient.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">الضغط الانقباضي</Label>
              <Input
                type="number"
                value={bpS}
                onChange={(e) => setBpS(e.target.value)}
                placeholder="120"
                className="bg-[#080E1A] border-white/10 text-white"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">الانبساطي</Label>
              <Input
                type="number"
                value={bpD}
                onChange={(e) => setBpD(e.target.value)}
                placeholder="80"
                className="bg-[#080E1A] border-white/10 text-white"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">النبض</Label>
              <Input
                type="number"
                value={hr}
                onChange={(e) => setHr(e.target.value)}
                placeholder="72"
                className="bg-[#080E1A] border-white/10 text-white"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-400">ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية…"
              className="bg-[#080E1A] border-white/10 text-white resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-400">صور / ملفات (اختياري)</Label>
            <Input
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="bg-[#080E1A] border-white/10 text-slate-300 file:bg-white/5 file:border-0 file:text-slate-300 file:ml-2"
            />
            {files.length > 0 && (
              <div className="text-[11px] text-slate-500">{files.length} ملف محدد</div>
            )}
          </div>

          {err && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {err}
            </div>
          )}

          {lastResult && (
            <div className="rounded-lg border p-3 text-xs space-y-2 bg-[#080E1A] border-white/10">
              <div className="flex items-center gap-2 text-emerald-300 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                تم حفظ القراءة بنجاح
              </div>
              {lastResult.alerts_count > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-300 font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    تم توليد {lastResult.alerts_count} تنبيه وإرساله لمجموعة التنبيهات
                  </div>
                  {lastResult.alerts_generated.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-slate-300 bg-white/5 rounded px-2 py-1">
                      <span>{paramLabel(a.parameter_name)} = {a.value}</span>
                      <div className="flex items-center gap-2">
                        <Badge className={
                          a.severity === "critical"
                            ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                            : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        }>
                          {a.severity === "critical" ? "حرج" : "تحذير"}
                        </Badge>
                        <span className="text-[10px] text-slate-500">
                          {a.telegram_sent ? "✓ أُرسل" : "✗ لم يُرسل"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400">جميع القيم ضمن المعدل الطبيعي — لا تنبيهات.</div>
              )}
            </div>
          )}

          <div className="text-[11px] text-slate-500 bg-white/5 rounded-lg p-2.5">
            سيتم تقييم القراءة مقابل العتبات النشطة (lower_bound / upper_bound).
            عند تجاوز حد، يُنشأ تنبيه واحد (دون تكرار إن كان هناك تنبيه غير مقروء سابق)
            ويُرسل تلقائياً لمجموعة التنبيهات في تيليجرام.
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-300">
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving || (!bpS && !bpD && !hr)}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
            حفظ القراءة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 bg-[#161C28] border-white/8">
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className="text-sm text-white font-medium mt-0.5 truncate">{value}</div>
    </Card>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#080E1A] border border-white/5 rounded-lg p-2.5">
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className="font-mono text-white text-sm mt-0.5" dir="ltr">{value}</div>
    </div>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-white/5">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="p-3">
              <div className="h-4 bg-white/5 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("");
}
function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return s;
  }
}
function fmtDateTime(s: string) {
  try {
    return new Date(s).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
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
function ageFromBirth(s: string) {
  const d = new Date(s);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 86400000));
}
function smokingLabel(s: string | null) {
  switch (s) {
    case "never": return "غير مدخّن";
    case "former": return "مدخّن سابق";
    case "current": return "مدخّن";
    default: return "—";
  }
}
function paramLabel(p: string) {
  switch (p) {
    case "bp_systolic": return "الضغط الانقباضي";
    case "bp_diastolic": return "الضغط الانبساطي";
    case "heart_rate": return "نبضات القلب";
    default: return p;
  }
}
