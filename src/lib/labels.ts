import type {
  QuoteStatus,
  ReservationStatus,
  VehicleStatus,
  WebRequestStatus,
  DepositStatus,
  ExpenseCategory,
  IncomeType,
  MaintenanceStatus,
  MaintenanceType,
  PaymentMethod,
} from "@/types/database";

import type { BadgeProps } from "@/components/ui/badge";

export const WEB_REQUEST_STATUS_LABELS: Record<WebRequestStatus, string> = {
  PENDING: "Pendiente",
  CONTACTED: "Contactado",
  QUOTED: "Cotizado",
  CONVERTED: "Convertido",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmada",
  ACTIVE: "Activa",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  AVAILABLE: "Disponible",
  RESERVED: "Reservado",
  RENTED: "Rentado",
  MAINTENANCE: "Mantenimiento",
  UNAVAILABLE: "No disponible",
  ARCHIVED: "Archivado",
};

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  RENTAL: "Renta",
  DEPOSIT: "Depósito",
  INSURANCE: "Seguro",
  EXTRA: "Extra",
  OTHER: "Otro",
};

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  RECEIVED: "Recibido",
  HELD: "Retenido",
  RETURNED: "Devuelto",
  APPLIED: "Aplicado",
  PARTIALLY_APPLIED: "Parcialmente aplicado",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  MAINTENANCE: "Mantenimiento",
  FUEL: "Combustible",
  INSURANCE: "Seguro",
  STAFF: "Personal",
  ADVERTISING: "Publicidad",
  WASH: "Lavado",
  PARTS: "Repuestos",
  COMMISSIONS: "Comisiones",
  FINES: "Multas",
  OTHER: "Otro",
};

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  OIL: "Aceite",
  BRAKES: "Frenos",
  TIRES: "Llantas",
  ENGINE: "Motor",
  TRANSMISSION: "Transmisión",
  AC: "Aire acondicionado",
  ELECTRICAL: "Eléctrico",
  BODY: "Carrocería",
  GENERAL: "General",
  OTHER: "Otro",
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  SCHEDULED: "Programado",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  pickup_due: "Entrega próxima",
  return_due: "Devolución próxima",
  maintenance_due_date: "Mantenimiento por fecha",
  maintenance_due_mileage: "Mantenimiento por kilometraje",
};

export function webRequestStatusVariant(
  status: WebRequestStatus,
): BadgeProps["variant"] {
  switch (status) {
    case "PENDING":
      return "warning";
    case "CONTACTED":
    case "QUOTED":
      return "info";
    case "CONVERTED":
      return "success";
    case "REJECTED":
    case "CANCELLED":
      return "danger";
    default:
      return "default";
  }
}

export function quoteStatusVariant(status: QuoteStatus): BadgeProps["variant"] {
  switch (status) {
    case "DRAFT":
      return "default";
    case "SENT":
      return "info";
    case "ACCEPTED":
      return "success";
    case "REJECTED":
    case "CANCELLED":
    case "EXPIRED":
      return "danger";
    default:
      return "default";
  }
}

export function reservationStatusVariant(
  status: ReservationStatus,
): BadgeProps["variant"] {
  switch (status) {
    case "CONFIRMED":
      return "info";
    case "ACTIVE":
      return "success";
    case "COMPLETED":
      return "default";
    case "CANCELLED":
      return "danger";
    default:
      return "default";
  }
}
