"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Clock, Save, Loader2 } from "lucide-react";

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

interface WorkingHour {
  id?: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const AVAIL_OPTS = [
  { id: "active", label: "متاح", desc: "يستقبل المواعيد", color: "from-emerald-500/20 to-emerald-500/5 border-emerald-400/30" },
  { id: "off_today", label: "إجازة اليوم", desc: "لا مواعيد اليوم", color: "from-amber-500/20 to-amber-500/5 border-amber-400/30" },
  { id: "after_hours_emergency", label: "طوارئ بعد الدوام", desc: "طوارئ فقط", color: "from-rose-500/20 to-rose-500/5 border-rose-400/30" },
];

export default function WorkingHoursView() {
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [availability, setAvailability] = useState("active");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [whRes, avRes] = await Promise.all([
        apiFetch<WorkingHour[]>("/admin/working-hours").catch(() => null),
        apiFetch<{ status: string }>("/admin/availability-status").catch(() => null),
      ]);
      const rows = (whRes?.data as WorkingHour[]) || [];
      // fill all 7 days
      const full: WorkingHour[] = DAYS.map((_, i) => {
        const r = rows.find((x) => x.day_of_week === i);
        return r || { day_of_week: i, start_time: "09:00", end_time: "17:00", is_active: false };
      });
      setHours(full);
      setAvailability(avRes?.data?.status || "active");
    } catch (e: any) {
      toast.error("فشل التحميل: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setAvailabilityStatus(status: string) {
    setAvailability(status);
    try {
      await apiFetch("/admin/availability-status", { method: "PUT", body: { status } });
      toast.success("تم تحديث حالة التوفر.");
    } catch (e: any) {
      toast.error("فشل: " + e.message);
    }
  }

  async function saveAll() {
    setSaving(true);
    let failures = 0;
    for (const h of hours) {
      try {
        await apiFetch("/admin/working-hours", { method: "PUT", body: h });
      } catch {
        failures++;
      }
    }
    setSaving(false);
    if (failures) toast.error(`${failures} صف فشل الحفظ.`);
    else toast.success("تم حفظ ساعات العمل.");
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">ساعات العمل</h1>
        <p className="text-sm text-slate-400 mt-0.5">ساعات عمل الطبيب الأسبوعية وحالة التوفر</p>
      </div>

      {/* Availability status */}
      <Card className="p-5 bg-[#161C28] border-white/8">
        <h3 className="text-sm font-semibold text-white mb-3">حالة الطبيب</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AVAIL_OPTS.map((o) => (
            <button
              key={o.id}
              onClick={() => setAvailabilityStatus(o.id)}
              className={`text-right p-4 rounded-xl border bg-gradient-to-br transition ${o.color} ${
                availability === o.id ? "ring-2 ring-offset-2 ring-offset-[#161C28] ring-teal-400" : "opacity-70 hover:opacity-100"
              }`}
            >
              <div className="text-sm font-semibold text-white">{o.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{o.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Weekly grid */}
      <Card className="p-5 bg-[#161C28] border-white/8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">ساعات العمل الأسبوعية</h3>
          <Button onClick={saveAll} disabled={saving} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
            حفظ الكل
          </Button>
        </div>
        {loading ? (
          <div className="text-center py-8 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-2">
            {hours.map((h, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 bg-[#080E1A] border border-white/5 rounded-lg">
                <div className="text-sm font-medium text-white w-24">{DAYS[h.day_of_week]}</div>
                <Input type="time" value={h.start_time} onChange={(e) => update(i, "start_time", e.target.value)} className="bg-[#161C28] border-white/10 text-white text-xs w-32" dir="ltr" />
                <span className="text-slate-500 text-xs">←</span>
                <Input type="time" value={h.end_time} onChange={(e) => update(i, "end_time", e.target.value)} className="bg-[#161C28] border-white/10 text-white text-xs w-32" dir="ltr" />
                <label className="flex items-center gap-1.5 text-xs text-slate-300 mr-auto">
                  <Switch checked={h.is_active} onCheckedChange={(v) => update(i, "is_active", v)} />
                  نشط
                </label>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> اضغط "حفظ الكل" لتخزين كل الأيام دفعة واحدة.
        </div>
      </Card>
    </div>
  );

  function update(idx: number, field: string, value: any) {
    setHours((prev) => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h));
  }
}
