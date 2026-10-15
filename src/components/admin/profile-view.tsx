"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User as UserIcon, Lock, Loader2 } from "lucide-react";

export default function ProfileView({ user }: { user: { id: string; name: string; phone_number: string } }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone_number);
  const [savingProfile, setSavingProfile] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    apiFetch<{ name: string; phone_number: string }>("/auth/me")
      .then((r) => { setName(r.data.name); setPhone(r.data.phone_number); })
      .catch(() => {});
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await apiFetch("/auth/profile", { method: "PUT", body: { name, phone_number: phone } });
      toast.success("تم تحديث الملف الشخصي.");
    } catch (e: any) {
      toast.error("فشل: " + e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (newPw !== confPw) { toast.error("كلمتا المرور غير متطابقتين."); return; }
    if (newPw.length < 8) { toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل."); return; }
    setSavingPw(true);
    try {
      await apiFetch("/auth/password", { method: "PUT", body: { current_password: curPw, new_password: newPw } });
      toast.success("تم تحديث كلمة المرور.");
      setCurPw(""); setNewPw(""); setConfPw("");
    } catch (e: any) {
      toast.error("فشل: " + e.message);
    } finally {
      setSavingPw(false);
    }
  }

  const match = newPw && confPw && newPw === confPw;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">الملف الشخصي</h1>
        <p className="text-sm text-slate-400 mt-0.5">إدارة بياناتك وكلمة المرور</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profile info */}
        <Card className="p-5 bg-[#161C28] border-white/8">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-teal-300" /> معلومات الملف
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">الاسم</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#080E1A] border-white/10 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">رقم الهاتف</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-[#080E1A] border-white/10 text-white font-mono text-sm" dir="ltr" />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={saveProfile} disabled={savingProfile} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white">
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
                حفظ الملف
              </Button>
            </div>
          </div>
        </Card>

        {/* Change password */}
        <Card className="p-5 bg-[#161C28] border-white/8">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-teal-300" /> تغيير كلمة المرور
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">كلمة المرور الحالية</Label>
              <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} className="bg-[#080E1A] border-white/10 text-white" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">كلمة المرور الجديدة</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="bg-[#080E1A] border-white/10 text-white" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">تأكيد كلمة المرور</Label>
              <Input type="password" value={confPw} onChange={(e) => setConfPw(e.target.value)} className="bg-[#080E1A] border-white/10 text-white" dir="ltr" />
              {confPw && (
                <p className={`text-[11px] ${match ? "text-emerald-400" : "text-rose-400"}`}>
                  {match ? "كلمتا المرور متطابقتان." : "كلمتا المرور غير متطابقتين."}
                </p>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={changePassword} disabled={savingPw || !curPw || !newPw || !confPw} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white">
                {savingPw ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
                تحديث كلمة المرور
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
