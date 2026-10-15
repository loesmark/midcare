"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, type Pagination } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ChevronRight, ChevronLeft, ClipboardList, Info } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AuditRow {
  id: number;
  actor_id: string | null;
  actor_ip: string | null;
  action: string;
  target: string | null;
  status: string;
  meta: string | null; // raw JSON string
  created_at: string;
}

/** Try to parse the raw `meta` JSON; return null if empty/invalid. */
function tryParseMeta(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Human-readable Arabic label for each audit action code. */
function actionLabelAr(action: string): string {
  const map: Record<string, string> = {
    SETTINGS_UPDATE: "تحديث الإعدادات",
    SETTINGS_AVAILABILITY: "تحديث حالة توفّر الطبيب",
    WORKING_HOURS_UPDATE: "تحديث ساعات العمل",
    THRESHOLD_CREATE: "إنشاء عتبة تنبيه",
    THRESHOLD_UPDATE: "تحديث عتبة تنبيه",
    THRESHOLD_DELETE: "حذف عتبة تنبيه",
    CATALOG_CREATE: "إضافة عنصر كتالوج",
    CATALOG_UPDATE: "تعديل عنصر كتالوج",
    CATALOG_DELETE: "حذف عنصر كتالوج",
    APPOINTMENT_CONFIRM: "تأكيد موعد",
    APPOINTMENT_CANCEL: "إلغاء موعد",
    CONSULTATION_RESPOND: "رد على استشارة",
    ALERT_RESOLVE: "حل تنبيه طبي",
    ALERT_READ: "تعليم تنبيه كمقروء",
    BACKUP_DOWNLOAD: "تنزيل نسخة احتياطية",
    TELEGRAM_TEST_IMAGE_GROUP: "اختبار مجموعة الصور",
    TELEGRAM_TEST_ALERT_GROUP: "اختبار مجموعة التنبيهات",
    TELEGRAM_TEST_WHATSAPP: "اختبار واتساب",
    SECURITY_LOGIN_SUCCESS: "تسجيل دخول ناجح",
    SECURITY_LOGIN_FAILED: "محاولة دخول فاشلة",
    SECURITY_LOGOUT: "تسجيل خروج",
    SECURITY_PASSWORD_CHANGE: "تغيير كلمة المرور",
    SECURITY_REGISTER: "تسجيل مريض جديد",
  };
  return map[action] || action;
}

export default function TechAuditView() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null); // row id whose meta is expanded
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "50" });
      if (actionFilter) q.set("action", actionFilter);
      const res = await apiFetch<AuditRow[]>(`/admin/audit-logs?${q}`);
      setRows(res.data);
      setPagination(res.pagination || null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">سجل التدقيق</h1>
          <p className="text-sm text-slate-400 mt-0.5">سجل الإجراءات الحساسة — كل تعديل إعداد أو إجراء أمني يُسجَّل هنا</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-slate-300">
          <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} /> تحديث
        </Button>
      </div>

      <Card className="p-3 bg-[#161C28] border-white/8 flex gap-2 items-center">
        <span className="text-xs text-slate-400">الإجراء</span>
        <Input
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          placeholder="مثال: SETTINGS، THRESHOLD، SECURITY، CATALOG…"
          className="bg-[#080E1A] border-white/10 text-white text-xs w-72"
        />
        {actionFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setActionFilter(""); setPage(1); }} className="text-slate-400 text-xs">مسح</Button>
        )}
      </Card>

      <Card className="p-0 overflow-hidden bg-[#161C28] border-white/8">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/8 text-slate-400">
                <th className="text-right font-medium p-2.5">الإجراء</th>
                <th className="text-right font-medium p-2.5">الهدف</th>
                <th className="text-right font-medium p-2.5">الحالة</th>
                <th className="text-right font-medium p-2.5">IP</th>
                <th className="text-right font-medium p-2.5">المستخدم</th>
                <th className="text-right font-medium p-2.5">الوقت</th>
                <th className="text-right font-medium p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-slate-500">جارٍ التحميل…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center">
                  <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">لا توجد سجلات تدقيق.</p>
                  <p className="text-slate-600 text-xs mt-1">
                    ستظهر هنا تلقائياً سجلات تعديل الإعدادات، العتبات، الكتالوجات، المواعيد، والمحاولات الأمنية.
                  </p>
                </td></tr>
              ) : (
                rows.map((r) => {
                  const meta = tryParseMeta(r.meta);
                  const isExpanded = expanded === r.id;
                  const hasMeta = meta !== null;
                  return (
                    <>
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-2.5">
                          <div className="font-mono text-slate-200">{r.action}</div>
                          <div className="text-[10px] text-slate-500">{actionLabelAr(r.action)}</div>
                        </td>
                        <td className="p-2.5 font-mono text-slate-400 truncate max-w-[260px]">{r.target || "—"}</td>
                        <td className="p-2.5">
                          {r.status === "success" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15">نجاح</Badge>
                          ) : (
                            <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/15">فشل</Badge>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-slate-400" dir="ltr">{r.actor_ip || "—"}</td>
                        <td className="p-2.5 font-mono text-slate-500" dir="ltr">{r.actor_id ? r.actor_id.slice(-8) : "—"}</td>
                        <td className="p-2.5 text-slate-400">{new Date(r.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}</td>
                        <td className="p-2.5">
                          {hasMeta && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-teal-300"
                              onClick={() => setExpanded(isExpanded ? null : r.id)}
                            >
                              {isExpanded ? "إخفاء" : "تفاصيل"}
                            </Button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && hasMeta && (
                        <tr key={`${r.id}-meta`} className="bg-[#080E1A]/40">
                          <td colSpan={7} className="p-3">
                            <MetaDetails meta={meta} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {pagination && (
          <div className="p-3 flex items-center justify-between border-t border-white/8">
            <div className="text-xs text-slate-500">صفحة {pagination.page} من {pagination.total_pages} · {pagination.total} سجل</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!pagination.has_prev} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronRight className="w-4 h-4" /> السابق</Button>
              <Button variant="outline" size="sm" disabled={!pagination.has_next} onClick={() => setPage((p) => p + 1)}>التالي <ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Renders the structured `meta` JSON of an audit row. Highlights the `diff`
 *  array (used by settings/threshold/catalog updates) as a key/from/to table;
 *  all other keys are shown as a flat key/value list. */
function MetaDetails({ meta }: { meta: Record<string, unknown> }) {
  const diff = Array.isArray(meta.diff) ? (meta.diff as Array<{ key: string; from?: string; to?: string }>) : null;
  const otherKeys = Object.keys(meta).filter((k) => k !== "diff");

  return (
    <div className="space-y-3 text-xs">
      {diff && diff.length > 0 && (
        <div>
          <div className="text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> التغييرات:
          </div>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/5 text-slate-400">
                  <th className="text-right font-medium p-2">الحقل</th>
                  <th className="text-right font-medium p-2">من</th>
                  <th className="text-right font-medium p-2">إلى</th>
                </tr>
              </thead>
              <tbody>
                {diff.map((d, i) => {
                  const isSensitive = /token|password|secret/i.test(d.key || "");
                  return (
                    <tr key={i} className="border-t border-white/5">
                      <td className="p-2 font-mono text-slate-200">{d.key}</td>
                      <td className="p-2 font-mono text-rose-300" dir="ltr">
                        {isSensitive ? "••••••" : (d.from ?? "∅")}
                      </td>
                      <td className="p-2 font-mono text-emerald-300" dir="ltr">
                        {isSensitive ? "••••••" : (d.to ?? "∅")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {otherKeys.length > 0 && (
        <div>
          <div className="text-slate-400 mb-1.5">تفاصيل إضافية:</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {otherKeys.map((k) => (
              <div key={k} className="bg-white/5 rounded-md px-2 py-1.5">
                <div className="text-[10px] text-slate-500 font-mono">{k}</div>
                <div className="font-mono text-slate-200 truncate" dir="ltr" title={String(meta[k] ?? "")}>
                  {String(meta[k] ?? "—")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
