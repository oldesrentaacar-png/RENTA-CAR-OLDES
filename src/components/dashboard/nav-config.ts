import type { PermissionKey } from "@/lib/auth/permissions";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Calendar,
  Car,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Clipboard,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  Tags,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey | PermissionKey[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const DASHBOARD_NAV: NavGroup[] = [
  {
    title: "DASHBOARD",
    items: [
      {
        label: "Panel",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard.view",
      },
      {
        label: "Alertas",
        href: "/dashboard/alertas",
        icon: Bell,
        permission: "dashboard.view",
      },
    ],
  },
  {
    title: "OPERACIÓN",
    items: [
      {
        label: "Solicitudes",
        href: "/dashboard/solicitudes",
        icon: ClipboardList,
        permission: "requests.view",
      },
      {
        label: "Clientes",
        href: "/dashboard/clientes",
        icon: UserCircle,
        permission: "customers.view",
      },
      {
        label: "Cotizaciones",
        href: "/dashboard/cotizaciones",
        icon: FileText,
        permission: "quotes.view",
      },
      {
        label: "Reservas",
        href: "/dashboard/reservas",
        icon: Calendar,
        permission: "reservations.view",
      },
      {
        label: "Calendario",
        href: "/dashboard/calendario",
        icon: Calendar,
        permission: "reservations.view",
      },
    ],
  },
  {
    title: "FLOTA",
    items: [
      {
        label: "Vehículos",
        href: "/dashboard/vehiculos",
        icon: Car,
        permission: "vehicles.view",
      },
      {
        label: "Inspecciones",
        href: "/dashboard/inspecciones",
        icon: ClipboardCheck,
        permission: "inspections.view",
      },
      {
        label: "Mantenimiento",
        href: "/dashboard/mantenimiento",
        icon: Wrench,
        permission: "maintenance.view",
      },
    ],
  },
  {
    title: "DOCUMENTOS",
    items: [
      {
        label: "Contratos",
        href: "/dashboard/contratos",
        icon: ScrollText,
        permission: "contracts.view",
      },
    ],
  },
  {
    title: "FINANZAS",
    items: [
      {
        label: "Resumen",
        href: "/dashboard/finanzas",
        icon: Wallet,
        permission: "finance.view",
      },
      {
        label: "Ingresos",
        href: "/dashboard/ingresos",
        icon: TrendingUp,
        permission: "finance.view",
      },
      {
        label: "Gastos",
        href: "/dashboard/gastos",
        icon: TrendingDown,
        permission: "finance.view",
      },
      {
        label: "Recibos",
        href: "/dashboard/recibos",
        icon: Receipt,
        permission: "finance.view",
      },
      {
        label: "Reportes",
        href: "/dashboard/reportes",
        icon: BarChart3,
        permission: "reports.view",
      },
    ],
  },
  {
    title: "ADMINISTRACIÓN",
    items: [
      {
        label: "Usuarios",
        href: "/dashboard/usuarios",
        icon: Users,
        permission: "users.view",
      },
      {
        label: "Roles y permisos",
        href: "/dashboard/roles",
        icon: Shield,
        permission: "roles.manage",
      },
      {
        label: "Configuración",
        href: "/dashboard/configuracion",
        icon: Settings,
        permission: "settings.view",
      },
      {
        label: "Tipos de vehículo",
        href: "/dashboard/configuracion/tipos-vehiculo",
        icon: Tags,
        permission: "settings.view",
      },
      {
        label: "Accesorios",
        href: "/dashboard/configuracion/accesorios",
        icon: Package,
        permission: "settings.view",
      },
      {
        label: "Auditoría",
        href: "/dashboard/auditoria",
        icon: Clipboard,
        permission: "audit.view",
      },
    ],
  },
];

export function filterNavByPermissions(
  groups: NavGroup[],
  has: (key: PermissionKey) => boolean,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.permission) return true;
        const keys = Array.isArray(item.permission)
          ? item.permission
          : [item.permission];
        return keys.some((key) => has(key));
      }),
    }))
    .filter((group) => group.items.length > 0);
}
