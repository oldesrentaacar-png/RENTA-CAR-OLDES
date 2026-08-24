"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import {
  DASHBOARD_NAV,
  filterNavByPermissions,
} from "@/components/dashboard/nav-config";
import { usePermissions } from "@/components/auth/permission-provider";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export type SidebarProps = {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
};

export function Sidebar({
  collapsed: controlledCollapsed,
  onCollapsedChange,
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const { has } = usePermissions();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = (value: boolean) => {
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(value);
    }
    onCollapsedChange?.(value);
  };

  const groups = filterNavByPermissions(DASHBOARD_NAV, has);

  return (
    <aside
      className={cn(
        "hidden h-full flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-fg transition-[width] duration-200 md:flex",
        collapsed ? "w-[4.5rem]" : "w-64",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-3">
        <Image
          src={BRAND.logoPath}
          alt={BRAND.fullName}
          width={collapsed ? 40 : 120}
          height={collapsed ? 40 : 48}
          className={cn(
            "shrink-0 rounded-md object-contain",
            collapsed ? "h-9 w-9" : "h-10 w-auto max-w-[7.5rem]",
          )}
          priority
        />
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-sidebar-fg-active">
              {BRAND.name}
            </p>
            <p className="truncate text-xs text-sidebar-fg">{BRAND.tagline}</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Principal">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed ? (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-wider text-sidebar-fg/70">
                {group.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation",
                        active
                          ? "bg-brand/20 text-sidebar-fg-active"
                          : "text-sidebar-fg hover:bg-sidebar-bg-hover hover:text-sidebar-fg-active",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-fg hover:bg-sidebar-bg-hover hover:text-sidebar-fg-active"
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Contraer</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

export function SidebarNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { has } = usePermissions();
  const groups = filterNavByPermissions(DASHBOARD_NAV, has);

  return (
    <nav className="px-2 py-4" aria-label="Principal">
      {groups.map((group) => (
        <div key={group.title} className="mb-4">
          <p className="mb-2 px-3 text-[10px] font-semibold tracking-wider text-sidebar-fg/70">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation",
                      active
                        ? "bg-brand/20 text-sidebar-fg-active"
                        : "text-sidebar-fg hover:bg-sidebar-bg-hover hover:text-sidebar-fg-active",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
