"use client";

import { usePathname } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/shell";

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return <DashboardShell pathname={pathname}>{children}</DashboardShell>;
}
