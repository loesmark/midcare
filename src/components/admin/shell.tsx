"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch, clearSession } from "@/lib/api-client";
import {
  LayoutDashboard,
  Users,
  Bell,
  SlidersHorizontal,
  Settings,
  LogOut,
  HeartPulse,
  Menu,
  X,
  Stethoscope,
  Calendar,
  BookMarked,
  Clock,
  User,
  Activity,
  ListOrdered,
  ClipboardList,
  Database,
  Wrench,
} from "lucide-react";
import DashboardView from "./dashboard-view";
import PatientsView from "./patients-view";
import AlertsView from "./alerts-view";
import ThresholdsView from "./thresholds-view";
import SettingsView from "./settings-view";
import ConsultationsView from "./consultations-view";
import AppointmentsView from "./appointments-view";
import CatalogsView from "./catalogs-view";
import WorkingHoursView from "./working-hours-view";
import ProfileView from "./profile-view";
import TechMetricsView from "./tech-metrics-view";
import TechLogsView from "./tech-logs-view";
import TechAuditView from "./tech-audit-view";
import TechBackupView from "./tech-backup-view";

type Mode = "clinical" | "technical";
type View =
  | "dashboard"
  | "patients"
  | "alerts"
  | "consultations"
  | "appointments"
  | "thresholds"
  | "catalogs"
  | "workingHours"
  | "profile"
  | "settings"
  | "techMetrics"
  | "techLogs"
  | "techAudit"
  | "techBackup";

const CLINICAL_NAV: { id: View; label: string; icon: typeof Users }[] = [
  { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { id: "alerts", label: "التنبيهات", icon: Bell },
  { id: "patients", label: "المرضى", icon: Users },
  { id: "consultations", label: "الاستشارات", icon: Stethoscope },
  { id: "appointments", label: "المواعيد", icon: Calendar },
  { id: "catalogs", label: "الكتالوجات", icon: BookMarked },
  { id: "thresholds", label: "العتبات", icon: SlidersHorizontal },
  { id: "workingHours", label: "ساعات العمل", icon: Clock },
  { id: "profile", label: "الملف الشخصي", icon: User },
  { id: "settings", label: "الإعدادات", icon: Settings },
];

const TECHNICAL_NAV: { id: View; label: string; icon: typeof Users }[] = [
  { id: "techMetrics", label: "المقاييس", icon: Activity },
  { id: "techLogs", label: "سجلات الطلبات", icon: ListOrdered },
  { id: "techAudit", label: "سجل التدقيق", icon: ClipboardList },
  { id: "techBackup", label: "النسخ الاحتياطي", icon: Database },
];

export default function Shell({
  user,
  onLogout,
}: {
  user: { id: string; name: string; phone_number: string; role: string };
  onLogout: () => void;
}) {
  const [view, setView] = useState<View>("dashboard");
  const [mode, setMode] = useState<Mode>("clinical");
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pollUnread = useCallback(async () => {
    try {
      const res = await apiFetch<{ count: number }>("/admin/alerts/unread-count");
      setUnread(res.data.count);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // Initial fetch + 30s polling for unread alert count.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void pollUnread();
    const t = setInterval(pollUnread, 30000);
    return () => clearInterval(t);
  }, [pollUnread]);

  function handleLogout() {
    clearSession();
    onLogout();
  }

  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");

  const nav = mode === "clinical" ? CLINICAL_NAV : TECHNICAL_NAV;

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[#0D131F] text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-30 h-16 bg-[#161C28]/95 backdrop-blur border-b border-white/8 flex items-center gap-3 px-4 lg:px-6">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="lg:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
          aria-label="القائمة"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-bold text-white leading-tight">MediCare</div>
            <div className="text-[10px] text-slate-500 leading-tight">لوحة الطبيب</div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Mode toggle */}
        <div className="inline-flex items-center bg-[#080E1A] border border-white/10 rounded-lg p-1 text-xs font-medium">
          <button
            onClick={() => setMode("clinical")}
            className={`px-2.5 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              mode === "clinical" ? "bg-gradient-to-l from-teal-500/30 to-emerald-500/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" /> سريري
          </button>
          <button
            onClick={() => setMode("technical")}
            className={`px-2.5 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              mode === "technical" ? "bg-gradient-to-l from-amber-500/30 to-orange-500/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" /> تقني
          </button>
        </div>

        {/* Alerts bell */}
        <button
          onClick={() => { setMode("clinical"); setView("alerts"); }}
          className="relative p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
          aria-label="التنبيهات"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#161C28]">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {/* User chip */}
        <div className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-white/5">
          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </span>
          <span className="hidden md:block text-sm text-white font-medium max-w-[120px] truncate">
            {user.name}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
        >
          <LogOut className="w-4 h-4 ml-1" />
          <span className="hidden sm:inline">خروج</span>
        </Button>
      </header>

      {/* Body */}
      <div className="flex-1 flex">
        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 lg:top-16 z-30 lg:z-10 w-60 h-[calc(100vh-4rem)] bg-[#161C28] border-l border-white/8 flex flex-col transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          }`}
        >
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    active
                      ? mode === "clinical"
                        ? "bg-gradient-to-l from-teal-500/20 to-emerald-500/10 text-white border border-teal-400/30"
                        : "bg-gradient-to-l from-amber-500/20 to-orange-500/10 text-white border border-amber-400/30"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? (mode === "clinical" ? "text-teal-300" : "text-amber-300") : ""}`} />
                  <span className="flex-1 text-right">{item.label}</span>
                  {item.id === "alerts" && unread > 0 && (
                    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/20">
                      {unread}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-white/8">
            <div className="text-[10px] text-slate-600 px-2 py-1">
              MediCare v3.0 · وضع {mode === "clinical" ? "السريري" : "التقني"}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 overflow-x-auto">
          {view === "dashboard" && <DashboardView onNavigate={(v) => { setMode("clinical"); setView(v as View); }} />}
          {view === "patients" && <PatientsView />}
          {view === "alerts" && <AlertsView onChanged={pollUnread} />}
          {view === "consultations" && <ConsultationsView />}
          {view === "appointments" && <AppointmentsView />}
          {view === "thresholds" && <ThresholdsView />}
          {view === "catalogs" && <CatalogsView />}
          {view === "workingHours" && <WorkingHoursView />}
          {view === "profile" && <ProfileView user={user} />}
          {view === "settings" && <SettingsView />}
          {view === "techMetrics" && <TechMetricsView />}
          {view === "techLogs" && <TechLogsView />}
          {view === "techAudit" && <TechAuditView />}
          {view === "techBackup" && <TechBackupView />}
        </main>
      </div>
    </div>
  );
}
