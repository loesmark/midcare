"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, type Pagination } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, ChevronRight, ChevronLeft, ListOrdered } from "lucide-react";

interface LogRow {
  id: number;
  method: string;
  path: string;
  status: number;
  duration_ms: number | null;
  user_id: string | null;
  ip: string | null;
  created_at: string;
}

export default function TechLogsView() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "50" });
      if (statusFilter) q.set("status", statusFilter);
      if (methodFilter) q.set("method", methodFilter);
      if (search) q.set("search", search);
      const res = await apiFetch<LogRow[]>(`/admin/logs?${q}`);
      setRows(res.data);
      setPagination(res.pagination || null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, methodFilter, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">سجلات الطلبات</h1>
          <p className="text-sm text-slate-400 mt-0.5">آخر الطلبات على الخادم</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-slate-300">
          <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} /> تحديث
        </Button>
      </div>

      <Card className="p-3 bg-[#161C28] border-white/8 flex flex-wrap gap-2 items-center">
        <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-36 bg-[#080E1A] border-white/10 text-white text-xs h-8"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
          <SelectContent className="bg-[#161C28] border-white/10">
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="2">2xx نجاح</SelectItem>
            <SelectItem value="3">3xx إعادة توجيه</SelectItem>
            <SelectItem value="4">4xx خطأ عميل</SelectItem>
            <SelectItem value="5">5xx خطأ خادم</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter || "all"} onValueChange={(v) => { setMethodFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-28 bg-[#080E1A] border-white/10 text-white text-xs h-8"><SelectValue placeholder="كل الطرق" /></SelectTrigger>
          <SelectContent className="bg-[#161C28] border-white-10">
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="بحث في المسار…"
          className="bg-[#080E1A] border-white/10 text-white text-xs w-48"
        />
        <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(""); setMethodFilter(""); setSearch(""); setPage(1); }} className="text-slate-400 mr-auto text-xs">
          مسح الفلاتر
        </Button>
      </Card>

      <Card className="p-0 overflow-hidden bg-[#161C28] border-white/8">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/8 text-slate-400">
                <th className="text-right font-medium p-2.5">الطريقة</th>
                <th className="text-right font-medium p-2.5">المسار</th>
                <th className="text-right font-medium p-2.5">الحالة</th>
                <th className="text-right font-medium p-2.5">IP</th>
                <th className="text-right font-medium p-2.5">المستخدم</th>
                <th className="text-right font-medium p-2.5">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-500">جارٍ التحميل…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center">
                  <ListOrdered className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">لا توجد سجلات.</p>
                </td></tr>
              ) : (
                rows.map((r) => {
                  const sc = Math.floor(r.status / 100);
                  const cls = sc === 2 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : sc === 4 ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : sc === 5 ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    : "bg-slate-500/15 text-slate-300 border-slate-500/30";
                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-2.5"><Badge className="bg-slate-500/15 text-slate-300 border-slate-500/30 hover:bg-slate-500/15 font-mono">{r.method}</Badge></td>
                      <td className="p-2.5 font-mono text-slate-300 truncate max-w-[300px]">{r.path}</td>
                      <td className="p-2.5"><Badge className={`${cls} hover:${cls} font-mono`}>{r.status}</Badge></td>
                      <td className="p-2.5 font-mono text-slate-400" dir="ltr">{r.ip || "—"}</td>
                      <td className="p-2.5 font-mono text-slate-500" dir="ltr">{r.user_id ? r.user_id.slice(-8) : "—"}</td>
                      <td className="p-2.5 text-slate-400">{new Date(r.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {pagination && (
          <div className="p-3 flex items-center justify-between border-t border-white/8">
            <div className="text-xs text-slate-500">صفحة {pagination.page} من {pagination.total_pages}</div>
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
