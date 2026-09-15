import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { PermissionProvider } from "@/components/auth/permission-provider";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Sidebar } from "@/components/dashboard/sidebar";
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
      {/* h-dvh + overflow-hidden: el scroll vive en <main>, no en el documento */}
      <div className="flex h-dvh max-h-dvh overflow-hidden bg-background">
        <Sidebar />
        <DashboardShell>{children}</DashboardShell>
      </div>
    </PermissionProvider>
  );
}
