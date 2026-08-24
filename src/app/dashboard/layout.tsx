import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { PermissionProvider } from "@/components/auth/permission-provider";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { getEffectivePermissions } from "@/lib/auth/permissions";
import { getCurrentProfile, getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  let profile = null;
  let permissions: Awaited<ReturnType<typeof getEffectivePermissions>> =
    new Set();

  if (isSupabaseConfigured()) {
    const auth = await getSession();
    if (!auth) {
      redirect("/login");
    }

    profile = await getCurrentProfile();
    if (!profile) {
      redirect("/login?error=inactive");
    }

    permissions = await getEffectivePermissions(auth.user.id);
  }

  return (
    <PermissionProvider
      permissions={[...permissions]}
      profile={profile}
    >
      <div className="flex min-h-dvh bg-background">
        <Sidebar />
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto overscroll-y-contain p-4 [-webkit-overflow-scrolling:touch] lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </PermissionProvider>
  );
}
