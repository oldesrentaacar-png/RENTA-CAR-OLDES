import { Suspense } from "react";

import { LoginPageClient, LoginShell } from "@/app/login/login-form";
import { isSupabaseConfigured } from "@/lib/env";

export default function LoginPage() {
  const supabaseConfigured = isSupabaseConfigured();

  return (
    <LoginShell>
      <Suspense fallback={<div className="text-center text-slate-400">Cargando…</div>}>
        <LoginPageClient supabaseConfigured={supabaseConfigured} />
      </Suspense>
    </LoginShell>
  );
}
