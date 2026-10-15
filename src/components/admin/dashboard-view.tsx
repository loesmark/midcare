"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Users, Bell, FileText, Activity, ArrowLeft } from "lucide-react";

interface Metrics {
  users: { total: number; patients: number; admins: number; active: number; suspended: number };
  alerts: { unread: number };
  records: { total: number };
  consultations: { pending: number };
  server_time: string;
}

export default function DashboardView({
  onNavigate,
}: {
  onNavigate: (v: "dashboard" | "patients" | "alerts" | "thresholds" | "settings") => void;
}) {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    apiFetch<Metrics>("/admin/metrics")
      .then((r) => setM(r.data))
      .catch((e) => setErr(e.message));
  }, []);

  const cards = [
    {
      label: "إجمالي المرضى",
      value: m?.users.patients ?? "—",
      icon: Users,
      color: "from-teal-500/20 to-emerald-500/5",
      iconColor: "text-teal-300",
      to: "patients" as const,
    },
    {
      label: "تنبيهات غير مقروءة",
      value: m?.alerts.unread ?? "—",
      icon: Bell,
      color: "from-rose-500/20 to-rose-500/5",
      iconColor: "text-rose-300",
      to: "alerts" as const,
    },
    {
      label: "السجلات الصحية",
      value: m?.records.total ?? "—",
      icon: FileText,
      color: "from-amber-500/20 to-amber-500/5",
      iconColor: "text-amber-300",
      to: "patients" as const,
    },
    {
      label: "استشارات معلّقة",
      value: m?.consultations.pending ?? "—",
      icon: Activity,
      color: "from-sky-500/20 to-sky-500/5",
      iconColor: "text-sky-300",
      to: "dashboard" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">لوحة التحكم</h1>
        <p className="text-sm text-slate-400 mt-0.5">نظرة عامة على النظام</p>
      </div>

      {err && (
        <Card className="p-4 text-sm text-rose-300 bg-rose-500/5 border-rose-500/20">{err}</Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => onNavigate(c.to)}
              className={`text-right bg-gradient-to-br ${c.color} border border-white/8 rounded-2xl p-5 hover:border-white/20 transition group`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${c.iconColor}`} />
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition" />
              </div>
              <div className="text-2xl font-bold text-white">{c.value}</div>
              <div className="text-xs text-slate-400 mt-1">{c.label}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 bg-[#161C28] border-white/8">
          <h3 className="text-sm font-semibold text-white mb-3">حالة المستخدمين</h3>
          <div className="space-y-2.5 text-sm">
            <Row label="إجمالي المستخدمين" value={m?.users.total} />
            <Row label="المرضى" value={m?.users.patients} />
            <Row label="المدراء" value={m?.users.admins} />
            <Row label="نشط" value={m?.users.active} />
            <Row label="موقوف" value={m?.users.suspended} />
          </div>
        </Card>

        <Card className="p-5 bg-[#161C28] border-white/8">
          <h3 className="text-sm font-semibold text-white mb-3">معلومات النظام</h3>
          <div className="space-y-2.5 text-sm">
            <Row label="وقت الخادم" value={m ? new Date(m.server_time).toLocaleString("ar-EG") : "—"} />
            <Row label="إصدار النظام" value="MediCare v3.0" />
            <Row label="نظام العتبات" value="lower_bound + upper_bound" />
            <Row label="مسارات الخطة العلاجية" value="معطّلة (الجداول محفوظة)" />
            <Row label="مجموعة تنبيهات تيليجرام" value="مفعّلة" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-white font-medium">{String(value ?? "—")}</span>
    </div>
  );
}
