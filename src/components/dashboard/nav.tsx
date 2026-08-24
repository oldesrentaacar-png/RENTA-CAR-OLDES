import Link from "next/link";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Inicio", exact: true },
  { href: "/dashboard/solicitudes", label: "Solicitudes" },
  { href: "/dashboard/clientes", label: "Clientes" },
  { href: "/dashboard/vehiculos", label: "Vehículos" },
  { href: "/dashboard/cotizaciones", label: "Cotizaciones" },
  { href: "/dashboard/reservas", label: "Reservas" },
  { href: "/dashboard/calendario", label: "Calendario" },
];

type DashboardNavProps = {
  pathname: string;
};

export function DashboardNav({ pathname }: DashboardNavProps) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
