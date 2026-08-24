import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "brand" | "success" | "warning" | "danger" | "info" | "outline" }
> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  CONTACTED: { label: "Contactado", variant: "info" },
  QUOTED: { label: "Cotizado", variant: "brand" },
  CONVERTED: { label: "Convertido", variant: "success" },
  REJECTED: { label: "Rechazado", variant: "danger" },
  CANCELLED: { label: "Cancelado", variant: "outline" },
  DRAFT: { label: "Borrador", variant: "default" },
  SENT: { label: "Enviado", variant: "info" },
  ACCEPTED: { label: "Aceptado", variant: "success" },
  EXPIRED: { label: "Vencido", variant: "warning" },
  CONFIRMED: { label: "Confirmada", variant: "brand" },
  ACTIVE: { label: "Activa", variant: "success" },
  COMPLETED: { label: "Completada", variant: "success" },
  AVAILABLE: { label: "Disponible", variant: "success" },
  RESERVED: { label: "Reservado", variant: "info" },
  RENTED: { label: "Rentado", variant: "brand" },
  MAINTENANCE: { label: "Mantenimiento", variant: "warning" },
  UNAVAILABLE: { label: "No disponible", variant: "danger" },
  ARCHIVED: { label: "Archivado", variant: "outline" },
  INACTIVE: { label: "Inactivo", variant: "outline" },
  SUSPENDED: { label: "Suspendido", variant: "danger" },
  SCHEDULED: { label: "Programado", variant: "info" },
  IN_PROGRESS: { label: "En progreso", variant: "warning" },
  CLIENT_SIGNED: { label: "Firmado cliente", variant: "info" },
  REPRESENTATIVE_SIGNED: { label: "Firmado rep.", variant: "brand" },
};

export type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status.replace(/_/g, " "),
    variant: "default" as const,
  };

  return (
    <Badge variant={config.variant} className={cn("capitalize", className)}>
      {label ?? config.label}
    </Badge>
  );
}

export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label ?? status.replace(/_/g, " ");
}
