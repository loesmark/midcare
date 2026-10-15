"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, type Pagination } from "@/lib/api-client";
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
import { Plus, Pencil, Trash2, BookMarked, Loader2 } from "lucide-react";
import { toast } from "sonner";

type CatId = "diseases" | "surgeries" | "symptoms" | "medications" | "consultation-types";

const CATS: { id: CatId; label: string; fields: { key: string; label: string; type?: "text" | "checkbox" | "select"; options?: string[] }[] }[] = [
  { id: "diseases", label: "الأمراض", fields: [{ key: "name", label: "الاسم" }, { key: "category", label: "الفئة" }] },
  { id: "surgeries", label: "العمليات", fields: [{ key: "name", label: "الاسم" }, { key: "category", label: "الفئة" }] },
  { id: "symptoms", label: "الأعراض", fields: [{ key: "name", label: "الاسم" }, { key: "category", label: "الفئة" }, { key: "is_critical", label: "حرج (تنبيه تلقائي)", type: "checkbox" }] },
  { id: "medications", label: "الأدوية", fields: [{ key: "brand_name", label: "الاسم التجاري" }, { key: "generic_name", label: "الاسم العلمي" }, { key: "form", label: "الشكل", type: "select", options: ["tablet", "capsule", "syrup", "injection"] }, { key: "category", label: "الفئة" }] },
  { id: "consultation-types", label: "أنواع الاستشارات", fields: [{ key: "name", label: "الاسم" }, { key: "category", label: "الفئة", type: "select", options: ["immediate", "regular"] }] },
];

export default function CatalogsView() {
  const [active, setActive] = useState<CatId>("diseases");
  const [rows, setRows] = useState<any[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "25" });
      const res = await apiFetch<any[]>(`/admin/catalogs/${active}?${q}`);
      setRows(res.data);
      setPagination(res.pagination || null);
    } catch (e: any) {
      toast.error("فشل التحميل: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [active, page]);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("حذف هذا العنصر؟")) return;
    try {
      await apiFetch(`/admin/catalogs/${active}/${id}`, { method: "DELETE" });
      toast.success("تم الحذف.");
      load();
    } catch (e: any) { toast.error("فشل: " + e.message); }
  }

  const cfg = CATS.find((c) => c.id === active)!;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">الكتالوجات</h1>
        <p className="text-sm text-slate-400 mt-0.5">قوائم يديرها الطبيب — أمراض، عمليات، أعراض، أدوية، أنواع استشارات</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => { setActive(c.id); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              active === c.id
                ? "bg-gradient-to-l from-teal-500/20 to-emerald-500/10 text-white border border-teal-400/30"
                : "bg-[#161C28] text-slate-400 border border-white/8 hover:text-white"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden bg-[#161C28] border-white/8">
        <div className="p-4 flex items-center justify-between border-b border-white/8">
          <h3 className="text-sm font-semibold text-white">{cfg.label}</h3>
          <Button onClick={() => setEditing("new")} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white">
            <Plus className="w-4 h-4 ml-1" /> إضافة
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-slate-400 text-xs">
                {cfg.fields.map((f) => <th key={f.key} className="text-right font-medium p-3">{f.label}</th>)}
                <th className="text-right font-medium p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={cfg.fields.length + 1} className="p-10 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={cfg.fields.length + 1} className="p-12 text-center">
                  <BookMarked className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">لا توجد عناصر بعد.</p>
                </td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-white/5 hover:bg-white/5">
                    {cfg.fields.map((f) => (
                      <td key={f.key} className="p-3 text-xs">
                        {f.type === "checkbox" ? (
                          r[f.key] ? <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/15">حرج</Badge> : <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/30 hover:bg-slate-500/15">عادي</Badge>
                        ) : (
                          <span className="text-white">{r[f.key] || <span className="text-slate-600">—</span>}</span>
                        )}
                      </td>
                    ))}
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-300" onClick={() => setEditing(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-300 hover:bg-rose-500/10" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination && (
          <div className="p-3 text-xs text-slate-500 border-t border-white/8">صفحة {pagination.page} من {pagination.total_pages} · {pagination.total} عنصر</div>
        )}
      </Card>

      {editing && <CatalogDialog cat={active} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function CatalogDialog({ cat, item, onClose, onSaved }: { cat: CatId; item: any | null; onClose: () => void; onSaved: () => void }) {
  const cfg = CATS.find((c) => c.id === cat)!;
  const [values, setValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    cfg.fields.forEach((f) => {
      if (item) init[f.key] = f.type === "checkbox" ? !!item[f.key] : (item[f.key] || "");
      else init[f.key] = f.type === "checkbox" ? false : "";
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const body = { ...values };
      if (item) {
        await apiFetch(`/admin/catalogs/${cat}/${item.id}`, { method: "PUT", body });
      } else {
        await apiFetch(`/admin/catalogs/${cat}`, { method: "POST", body });
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
          <DialogTitle className="text-white">{item ? "تعديل" : "إضافة"} — {cfg.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {cfg.fields.map((f) => (
            <div key={f.key} className="space-y-1">
              {f.type !== "checkbox" && <Label className="text-xs text-slate-400">{f.label}</Label>}
              {f.type === "select" ? (
                <Select value={values[f.key] || ""} onValueChange={(v) => setValues({ ...values, [f.key]: v })}>
                  <SelectTrigger className="bg-[#080E1A] border-white/10 text-white"><SelectValue placeholder={`اختر ${f.label}`} /></SelectTrigger>
                  <SelectContent className="bg-[#161C28] border-white/10">
                    {f.options!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : f.type === "checkbox" ? (
                <div className="flex items-center justify-between bg-[#080E1A] border border-white/5 rounded-lg px-3 py-2.5">
                  <Label className="text-sm text-slate-300">{f.label}</Label>
                  <Switch checked={values[f.key]} onCheckedChange={(v) => setValues({ ...values, [f.key]: v })} />
                </div>
              ) : (
                <Input
                  value={values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="bg-[#080E1A] border-white/10 text-white"
                />
              )}
            </div>
          ))}
          {err && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{err}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-300">إلغاء</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
            {item ? "حفظ" : "إنشاء"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
