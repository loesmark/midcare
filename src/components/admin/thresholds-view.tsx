"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, SlidersHorizontal, Loader2 } from "lucide-react";

interface Threshold {
  id: string;
  parameter_name: string;
  lower_bound: number | null;
  upper_bound: number | null;
  is_active: boolean;
  created_at: string;
}

const PARAMS = [
  { value: "bp_systolic", label: "الضغط الانقباضي (mmHg)" },
  { value: "bp_diastolic", label: "الضغط الانبساطي (mmHg)" },
  { value: "heart_rate", label: "نبضات القلب (bpm)" },
];

export default function ThresholdsView() {
  const [rows, setRows] = useState<Threshold[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<Threshold | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await apiFetch<Threshold[]>("/admin/thresholds");
      setRows(res.data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("حذف هذه العتبة؟")) return;
    try {
      await apiFetch(`/admin/thresholds/${id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">العتبات</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            عتبات القياسات — التصميم الجديد بحدّين <span className="font-mono text-teal-300">lower_bound</span> و{" "}
            <span className="font-mono text-teal-300">upper_bound</span> (تنبيه واحد لكل قياس)
          </p>
        </div>
        <Button
          onClick={() => setEditing("new")}
          className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
        >
          <Plus className="w-4 h-4 ml-1" /> إضافة عتبة
        </Button>
      </div>

      <div className="rounded-lg border border-teal-400/20 bg-teal-500/5 p-3 text-xs text-teal-200">
        عند إدخال قراءة جديدة، إذا كانت قيمة القياس{" "}
        <span className="font-mono">أقل من lower_bound</span> أو{" "}
        <span className="font-mono">أعلى من upper_bound</span>، يُنشأ تنبيه واحد
        (لا يتكرر ما دام هناك تنبيه غير مقروء لنفس القياس) ويُرسل لمجموعة التنبيهات.
      </div>

      {err && <Card className="p-4 text-sm text-rose-300 bg-rose-500/5 border-rose-500/20">{err}</Card>}

      <Card className="p-0 overflow-hidden bg-[#161C28] border-white/8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-slate-400 text-xs">
                <th className="text-right font-medium p-3">القياس</th>
                <th className="text-right font-medium p-3">الحد الأدنى (lower_bound)</th>
                <th className="text-right font-medium p-3">الحد الأقصى (upper_bound)</th>
                <th className="text-right font-medium p-3">الحالة</th>
                <th className="text-right font-medium p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500">جارٍ التحميل…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <SlidersHorizontal className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">لا توجد عتبات. أضف عتبة لبدء تقييم القراءات تلقائياً.</p>
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-medium text-white">{paramLabel(t.parameter_name)}</td>
                    <td className="p-3 font-mono text-amber-300" dir="ltr">
                      {t.lower_bound != null ? t.lower_bound : "—"}
                    </td>
                    <td className="p-3 font-mono text-rose-300" dir="ltr">
                      {t.upper_bound != null ? t.upper_bound : "—"}
                    </td>
                    <td className="p-3">
                      {t.is_active ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15">نشط</Badge>
                      ) : (
                        <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30 hover:bg-slate-500/15">معطّل</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-300" onClick={() => setEditing(t)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-300 hover:bg-rose-500/10" onClick={() => remove(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <ThresholdDialog
          threshold={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ThresholdDialog({
  threshold,
  onClose,
  onSaved,
}: {
  threshold: Threshold | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [param, setParam] = useState(threshold?.parameter_name || "bp_systolic");
  const [lower, setLower] = useState(threshold?.lower_bound?.toString() || "");
  const [upper, setUpper] = useState(threshold?.upper_bound?.toString() || "");
  const [active, setActive] = useState(threshold?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const body: any = {
        parameter_name: param,
        lower_bound: lower === "" ? null : Number(lower),
        upper_bound: upper === "" ? null : Number(upper),
        is_active: active,
      };
      if (threshold) {
        await apiFetch(`/admin/thresholds/${threshold.id}`, { method: "PUT", body });
      } else {
        await apiFetch("/admin/thresholds", { method: "POST", body });
      }
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#161C28] border-white/10 text-slate-200 max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white">{threshold ? "تعديل عتبة" : "إضافة عتبة"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">القياس</Label>
            <Select value={param} onValueChange={setParam}>
              <SelectTrigger className="bg-[#080E1A] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#161C28] border-white/10">
                {PARAMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">الحد الأدنى (lower_bound)</Label>
              <Input
                type="number"
                value={lower}
                onChange={(e) => setLower(e.target.value)}
                placeholder="90"
                className="bg-[#080E1A] border-white/10 text-white"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">الحد الأقصى (upper_bound)</Label>
              <Input
                type="number"
                value={upper}
                onChange={(e) => setUpper(e.target.value)}
                placeholder="140"
                className="bg-[#080E1A] border-white/10 text-white"
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#080E1A] border border-white/5 rounded-lg px-3 py-2.5">
            <Label className="text-sm text-slate-300">نشط</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          {err && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-300">إلغاء</Button>
          <Button
            onClick={save}
            disabled={saving || (!lower && !upper)}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
            {threshold ? "حفظ" : "إنشاء"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function paramLabel(p: string) {
  const f = PARAMS.find((x) => x.value === p);
  return f ? f.label : p;
}
