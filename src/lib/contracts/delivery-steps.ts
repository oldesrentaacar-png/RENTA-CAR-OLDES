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
    hasPdf,
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
      linkLabel: checkOutId ? "Ver inspección" : "Crear inspección",
    },
    {
      id: "accesorios",
      title: "Accesorios",
      description: checkOutId
        ? checkOutChecklistCount > 0
          ? `${checkOutChecklistCount} ítems en checklist de salida.`
          : "Inspección sin checklist; complete los accesorios."
        : "Disponible tras la inspección de salida.",
      status: !checkOutId
        ? "pending"
        : checkOutChecklistCount > 0
          ? "done"
          : "partial",
      href: checkOutId
        ? `/dashboard/inspecciones/${checkOutId}`
        : `/dashboard/inspecciones/nuevo?reservation_id=${reservationId}&type=CHECK_OUT`,
      linkLabel: checkOutId ? "Revisar checklist" : "Crear inspección",
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
      linkLabel: "Ir a abonos",
    },
    {
      id: "firma",
      title: "Términos y firma",
      description: hasClientSignature
        ? "Cliente firmado. Operador registrado automáticamente."
        : "Pendiente firma del cliente.",
      status: hasClientSignature ? "done" : "pending",
      href: `/dashboard/contratos/${contractId}/sign`,
      linkLabel: hasClientSignature ? "Ver firmas" : "Firmar cliente",
    },
    {
      id: "pdf",
      title: "PDF generado",
      description: hasPdf
        ? "PDF almacenado en el contrato."
        : "El PDF se genera bajo demanda (siempre disponible).",
      status: "done",
      href: contractPdfHref(contractId),
      linkLabel: "Ver PDF",
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
