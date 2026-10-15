"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, setSession } from "@/lib/api-client";
import { HeartPulse, Loader2, Lock, Phone } from "lucide-react";

export default function Login({
  onLogin,
}: {
  onLogin: (u: { id: string; name: string; phone_number: string; role: string; status: string }) => void;
}) {
  const [phone, setPhone] = useState("01000000000");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: any }>("/auth/doctor-login", {
        method: "POST",
        body: { phone_number: phone, password },
      });
      setSession(res.data.token, res.data.user);
      onLogin(res.data.user);
    } catch (err: any) {
      setError(err.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0D131F] via-[#0f1a24] to-[#0a1a1f] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20 mb-4">
            <HeartPulse className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">MediCare</h1>
          <p className="text-sm text-slate-400 mt-1">لوحة تحكم الطبيب — نظام المتابعة الطبية</p>
        </div>

        {/* Card */}
        <div className="bg-[#161C28]/80 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-1">تسجيل الدخول</h2>
          <p className="text-xs text-slate-400 mb-5">أدخل رقم الهاتف وكلمة المرور للمتابعة</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-[#080E1A] border-white/10 text-white placeholder:text-slate-600 pr-9 text-right"
                  placeholder="01000000000"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#080E1A] border-white/10 text-white placeholder:text-slate-600 pr-9 text-right"
                  placeholder="••••••••"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              دخول
            </Button>
          </form>

          
        </div>
      </div>
    </div>
  );
}
