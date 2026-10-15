"use client";

import { useEffect, useState } from "react";
import Login from "@/components/admin/login";
import Shell from "@/components/admin/shell";
import { getToken, getStoredUser } from "@/lib/api-client";

export interface AdminUser {
  id: string;
  name: string;
  phone_number: string;
  role: string;
  status: string;
}

export default function Page() {
  // Render a neutral loading state on the server AND the first client paint
  // (avoids hydration mismatch: SSR has no localStorage so it would render
  // <Login/>, while the client would render <Shell/>). After mount we read
  // localStorage and render the real UI.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (!mounted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthed(!!getToken());
    setUser(getStoredUser<AdminUser>());
  }, [mounted]);

  function onLogin(u: AdminUser) {
    setAuthed(true);
    setUser(u);
  }

  function onLogout() {
    setAuthed(false);
    setUser(null);
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D131F]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-400 border-t-transparent" />
      </div>
    );
  }

  if (!authed || !user) return <Login onLogin={onLogin} />;
  return <Shell user={user} onLogout={onLogout} />;
}
