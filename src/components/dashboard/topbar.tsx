"use client";

import { ChevronDown, LogOut, Menu, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { logoutAction } from "@/app/login/actions";
import { usePermissions } from "@/components/auth/permission-provider";
import { AlertsBell } from "@/components/dashboard/alerts-bell";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Panel",
  solicitudes: "Solicitudes",
  clientes: "Clientes",
  cotizaciones: "Cotizaciones",
  reservas: "Reservas",
  calendario: "Calendario",
  vehiculos: "Vehículos",
  inspecciones: "Inspecciones",
  mantenimiento: "Mantenimiento",
  contratos: "Contratos",
  finanzas: "Finanzas",
  ingresos: "Ingresos",
  gastos: "Gastos",
  reportes: "Reportes",
  alertas: "Alertas",
  usuarios: "Usuarios",
  roles: "Roles y permisos",
  configuracion: "Configuración",
  auditoria: "Auditoría",
};

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [
    { label: "Panel", href: "/dashboard" },
  ];

  if (segments.length <= 1) {
    return [{ label: "Panel" }];
  }

  let path = "";
  for (let i = 1; i < segments.length; i += 1) {
    const segment = segments[i];
    path += `/${segment}`;
    const isLast = i === segments.length - 1;
    crumbs.push({
      label: ROUTE_LABELS[segment] ?? segment,
      href: isLast ? undefined : `/dashboard${path}`,
    });
  }

  return crumbs;
}

export function Topbar() {
  const pathname = usePathname();
  const { profile, has } = usePermissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const breadcrumbs = buildBreadcrumbs(pathname);
  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : "Usuario";

  useEffect(() => {
    setMenuOpen(false);
    setMobileNavOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => {
            setMenuOpen(false);
            setMobileNavOpen(true);
          }}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 sm:block">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-brand">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="font-medium text-foreground">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {has("dashboard.view") ? <AlertsBell /> : null}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                setMenuOpen((open) => !open);
              }}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-sm hover:bg-surface-muted"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-brand">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden max-w-[120px] truncate font-medium text-foreground md:inline">
                {displayName}
              </span>
              <ChevronDown className="hidden h-4 w-4 text-muted md:block" />
            </button>

            {menuOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40 touch-none bg-black/10"
                  onPointerDown={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-surface py-1 shadow-lg"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {profile?.email ?? ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    disabled={pending}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-surface-muted",
                      pending && "opacity-50",
                    )}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </>
  );
}
