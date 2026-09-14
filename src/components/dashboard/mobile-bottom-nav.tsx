"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Car,
  LayoutDashboard,
  Menu,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { usePermissions } from "@/components/auth/permission-provider";
import type { PermissionKey } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type TabItem = {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  permission?: PermissionKey | PermissionKey[];
  more?: boolean;
};

const PRIMARY_TABS: TabItem[] = [
  {
    id: "panel",
    label: "Panel",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.view",
  },
  {
    id: "reservas",
    label: "Reservas",
    href: "/dashboard/reservas",
    icon: Calendar,
    permission: "reservations.view",
  },
  {
    id: "vehiculos",
    label: "Flota",
    href: "/dashboard/vehiculos",
    icon: Car,
    permission: "vehicles.view",
  },
  {
    id: "contratos",
    label: "Contratos",
    href: "/dashboard/contratos",
    icon: ScrollText,
    permission: "contracts.view",
  },
  {
    id: "more",
    label: "Más",
    icon: Menu,
    more: true,
  },
];

function matchesPermission(
  has: (key: PermissionKey) => boolean,
  permission?: PermissionKey | PermissionKey[],
) {
  if (!permission) return true;
  const keys = Array.isArray(permission) ? permission : [permission];
  return keys.some((key) => has(key));
}

function isTabActive(pathname: string, href?: string) {
  if (!href) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type MobileBottomNavProps = {
  onOpenMore: () => void;
};

export function MobileBottomNav({ onOpenMore }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { has } = usePermissions();

  const tabs = PRIMARY_TABS.filter((tab) =>
    matchesPermission(has, tab.permission),
  );

  return (
    <nav
      aria-label="Navegación rápida"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/90 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul
        className="grid h-14 items-stretch"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.more ? false : isTabActive(pathname, tab.href);

          if (tab.more) {
            return (
              <li key={tab.id} className="min-w-0">
                <button
                  type="button"
                  onClick={onOpenMore}
                  className="flex h-full w-full flex-col items-center justify-center gap-0.5 touch-manipulation text-[10px] font-medium text-muted"
                  aria-label="Abrir menú completo"
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                  <span className="truncate px-0.5">{tab.label}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={tab.id} className="min-w-0">
              <Link
                href={tab.href!}
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-0.5 touch-manipulation text-[10px] font-medium",
                  active ? "text-brand" : "text-muted",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn("h-5 w-5", active && "text-brand")}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className="truncate px-0.5">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
