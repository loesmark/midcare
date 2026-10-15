"use client";

import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database, Download, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

interface BackupInfo {
  enabled: boolean;
  db_path: string;
  db_size_bytes: number;
  db_size_human: string;
  rate_limit: string;
}

export default function TechBackupView() {
  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [passcode, setPasscode] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiFetch<BackupInfo>("/admin/backup-db/info")
      .then((r) => setInfo(r.data))
      .catch(() => {});
  }, []);

  async function download() {
    if (!passcode) { toast.error("أدخل رمز النسخ الاحتياطي."); return; }
    setDownloading(true);
    try {
      const res = await fetch("/api/v1/admin/backup-db", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ passcode }),
      });
      if (res.status === 401) { toast.error("انتهت الجلسة."); return; }
      if (!res.ok) {
        let msg = `فشل (HTTP ${res.status})`;
        try { const j = await res.json(); if (j?.error?.message) msg = j.error.message; } catch {}
        toast.error(msg); return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("X-Backup-File") || "medicare-backup.db";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("تم تنزيل نسخة احتياطية.");
    } catch (e: any) {
      toast.error("خطأ شبكي: " + e.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">النسخ الاحتياطي</h1>
        <p className="text-sm text-slate-400 mt-0.5">تنزيل نسخة من قاعدة البيانات</p>
      </div>

      <Card className="p-5 bg-[#161C28] border-white/8">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Database className="w-4 h-4 text-teal-300" /> معلومات قاعدة البيانات
        </h3>
        {info ? (
          <div className="space-y-2 text-sm">
            <Row label="مفعّل" value={info.enabled ? "نعم" : "لا"} />
            <Row label="المسار" value={<code className="font-mono text-xs text-slate-300">{info.db_path}</code>} />
            <Row label="الحجم" value={<span className="font-mono text-white">{info.db_size_human}</span>} />
            <Row label="حد المعدل" value={<span className="font-mono text-white">{info.rate_limit}</span>} />
          </div>
        ) : (
          <div className="text-sm text-slate-500">جارٍ التحميل…</div>
        )}
      </Card>

      <Card className="p-5 bg-[#161C28] border-white/8">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Download className="w-4 h-4 text-teal-300" /> تنزيل نسخة احتياطية
        </h3>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">رمز النسخ الاحتياطي</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="أدخل الرمز"
                className="bg-[#080E1A] border-white/10 text-white pr-9"
                dir="ltr"
              />
            </div>
            <p className="text-[11px] text-slate-500">الرمز التجريبي: <code className="font-mono">admin-passcode</code></p>
          </div>
          <Button onClick={download} disabled={downloading || !passcode} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Download className="w-4 h-4 ml-1" />}
            تنزيل النسخة
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between items-center"><span className="text-slate-400">{label}</span><span>{value}</span></div>;
}
