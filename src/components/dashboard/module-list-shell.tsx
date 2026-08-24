import type { ReactNode } from "react";

import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import type { PermissionKey } from "@/lib/auth/permissions";

export type ModuleListShellProps = {
  title: string;
  description: string;
  permission: PermissionKey;
  configured: boolean;
  error: string | null;
  count: number;
  countLabel: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function ModuleListShell({
  title,
  description,
  permission,
  configured,
  error,
  count,
  countLabel,
  children,
  actions,
}: ModuleListShellProps) {
  return (
    <PermissionGuard permission={permission}>
      <div className="space-y-6">
        <PageHeader title={title} description={description} actions={actions} />

        {!configured ? <SetupBanner /> : null}

        {configured && !error ? (
          <p className="text-sm text-muted">
            {count} {countLabel}
          </p>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {children}
      </div>
    </PermissionGuard>
  );
}
