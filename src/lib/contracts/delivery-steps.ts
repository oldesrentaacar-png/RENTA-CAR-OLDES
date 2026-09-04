import type { DeliveryStep } from "@/components/contracts/delivery-checklist";
import { formatMoney } from "@/lib/money";
import { contractPdfHref } from "@/lib/pdf/contract-pdf-meta";

export type DeliveryStepsInput = {
  contractId: string;
  reservationId: string;
  customerName: string;
  vehicleLabel: string;
  checkOutId: string | null;
  checkOutChecklistCount: number;
  amountPaid: number;
  hasClientSignature: boolean;
  hasRepresentativeSignature: boolean;
  hasPdf: boolean;
};

export function buildDeliverySteps(input: DeliveryStepsInput): DeliveryStep[] {
  const {
    contractId,
    reservationId,
    customerName,
    vehicleLabel,
    checkOutId,
    checkOutChecklistCount,
    amountPaid,
    hasClientSignature,
  } = input;

  return [
    {
      id: "cliente-vehiculo",
      title: "Cliente y vehículo",
      description: `${customerName} · ${vehicleLabel}`,
      status: "done",
    },
    {
      id: "inspeccion-salida",
      title: "Inspección de salida",
      description: checkOutId
        ? "Inspección CHECK_OUT registrada."
        : "Registre la inspección de salida antes de entregar.",
      status: checkOutId ? "done" : "pending",
      href: checkOutId
        ? `/dashboard/inspecciones/${checkOutId}`
        : `/dashboard/inspecciones/nuevo?reservation_id=${reservationId}&type=CHECK_OUT`,
      linkLabel: checkOutId ? "Ver / Editar inspección" : "Crear inspección",
    },
    {
      id: "accesorios",
      title: "Accesorios y mapa de daños",
      description: checkOutId
        ? checkOutChecklistCount > 0
          ? `${checkOutChecklistCount} ítems · puede revisar y corregir`
          : "Complete checklist y mapa de daños."
        : "Disponible tras la inspección de salida.",
      status: !checkOutId
        ? "pending"
        : checkOutChecklistCount > 0
          ? "done"
          : "partial",
      href: checkOutId
        ? `/dashboard/inspecciones/${checkOutId}#accesorios`
        : `/dashboard/inspecciones/nuevo?reservation_id=${reservationId}&type=CHECK_OUT`,
      linkLabel: checkOutId ? "Ver / Editar accesorios" : "Crear inspección",
    },
    {
      id: "facturacion",
      title: "Facturación / abono inicial",
      description:
        amountPaid > 0
          ? `Abonado: ${formatMoney(amountPaid)}`
          : "Registre el abono inicial en la sección de recibos.",
      status: amountPaid > 0 ? "done" : "pending",
      href: `/dashboard/contratos/${contractId}#abonos`,
      linkLabel: amountPaid > 0 ? "Ver / Editar abonos" : "Ir a abonos",
    },
    {
      id: "firma",
      title: "Términos y firma",
      description: hasClientSignature
        ? "Cliente firmado. Puede revisar la firma."
        : "Pendiente firma del cliente.",
      status: hasClientSignature ? "done" : "pending",
      href: `/dashboard/contratos/${contractId}/sign`,
      linkLabel: hasClientSignature ? "Ver / Editar firmas" : "Firmar cliente",
    },
    {
      id: "pdf",
      title: "PDF del contrato",
      description: hasClientSignature
        ? "Firmado por el cliente — listo para ver y compartir."
        : "Vista interna disponible. Comparta solo después de la firma del cliente.",
      status: hasClientSignature ? "done" : "partial",
      href: contractPdfHref(contractId),
      linkLabel: hasClientSignature
        ? "Ver / Compartir PDF"
        : "Ver PDF (vista interna)",
    },
  ];
}

/** Paso actual según la pantalla donde está el usuario. */
export function resolveDeliveryStepId(input: {
  inspectionType?: "CHECK_OUT" | "CHECK_IN";
  checkOutChecklistCount?: number;
  onSignPage?: boolean;
}): string | undefined {
  if (input.onSignPage) return "firma";
  if (input.inspectionType === "CHECK_OUT") {
    return (input.checkOutChecklistCount ?? 0) > 0
      ? "accesorios"
      : "inspeccion-salida";
  }
  return undefined;
}
