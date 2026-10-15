"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { RefreshCw, Activity, Users, Bell, FileText } from "lucide-react";

interface Metrics {
  users: { total: number; patients: number; admins: number; active: number; suspended: number };
  alerts: { unread: number };
  records: { total: number };
  consultations: { pending: number };
  server_time: string;
}

export default function TechMetricsView() {
  const [m, setM] = useState<Metrics | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<{ status: string; count: number }[]>([]);
  const [topEndpoints, setTopEndpoints] = useState<{ path: string; hits: number }[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [mRes, sbRes, teRes] = await Promise.all([
        apiFetch<Metrics>("/admin/metrics"),
        apiFetch<{ status: string; count: number }[]>("/admin/logs/status-breakdown").catch(() => null),
        apiFetch<{ path: string; hits: number }[]>("/admin/logs/top-endpoints").catch(() => null),
      ]);
      setM(mRes.data);
      setStatusBreakdown(sbRes?.data || []);
      setTopEndpoints(teRes?.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">مقاييس النظام</h1>
          <p className="text-sm text-slate-400 mt-0.5">صحة الخادم والإحصائيات</p>
        </div>
        <button onClick={load} className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/5">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {m ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Activity} label="وقت الخادم" value={new Date(m.server_time).toLocaleString("ar-EG")} color="text-sky-300" />
            <KpiCard icon={Users} label="إجمالي المستخدمين" value={String(m.users.total)} color="text-teal-300" />
            <KpiCard icon={Bell} label="تنبيهات غير مقروءة" value={String(m.alerts.unread)} color="text-rose-300" />
            <KpiCard icon={FileText} label="السجلات الصحية" value={String(m.records.total)} color="text-amber-300" />
          </div>

          {/* Users + system */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 bg-[#161C28] border-white/8">
              <h3 className="text-sm font-semibold text-white mb-3">المستخدمون</h3>
              <div className="space-y-2 text-sm">
                <Row label="المرضى" value={m.users.patients} />
                <Row label="المدراء" value={m.users.admins} />
                <Row label="نشط" value={m.users.active} />
                <Row label="موقوف" value={m.users.suspended} />
              </div>
            </Card>
            <Card className="p-5 bg-[#161C28] border-white/8">
              <h3 className="text-sm font-semibold text-white mb-3">توزيع حالات HTTP</h3>
              {statusBreakdown.length ? (
                <div className="space-y-2">
                  {statusBreakdown.map((s) => (
                    <div key={s.status} className="flex items-center justify-between">
                      <span className="text-sm text-slate-300 font-mono">{s.status}</span>
                      <span className="text-white font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="text-sm text-slate-500">لا بيانات.</div>}
            </Card>
          </div>

          {/* Top endpoints */}
          <Card className="p-5 bg-[#161C28] border-white/8">
            <h3 className="text-sm font-semibold text-white mb-3">أكثر المسارات طلباً</h3>
            {topEndpoints.length ? (
              <div className="space-y-1.5">
                {topEndpoints.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-mono truncate max-w-[70%]">{e.path}</span>
                    <span className="text-white font-medium">{e.hits}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-slate-500">لا بيانات.</div>}
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center text-slate-500">جارٍ التحميل…</Card>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: string; color: string }) {
  return (
    <Card className="p-4 bg-[#161C28] border-white/8">
      <Icon className={`w-5 h-5 ${color} mb-2`} />
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-base font-bold text-white mt-0.5 truncate">{value}</div>
    </Card>
  );
}
function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between"><span className="text-slate-400">{label}</span><span className="text-white font-medium">{value}</span></div>;
}
