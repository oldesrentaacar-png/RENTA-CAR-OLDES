import type { DeliveryStep } from "@/components/contracts/delivery-checklist";
import { formatMoney } from "@/lib/money";

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
  updatedAt?: string | null;
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
    updatedAt,
  } = input;

  return [
    {
      id: "cliente-vehiculo",
      title: "Cliente, vehículo y cobros",
      description: `${customerName} · ${vehicleLabel}. Revise tarifas y extras (silla, entrega, etc.) aquí.`,
      status: "done",
      href: `/dashboard/contratos/${contractId}?paso=cliente-vehiculo`,
      linkLabel: "Ver / Editar cobros",
    },
    {
      id: "inspeccion-salida",
      title: "Inspección de salida",
      description: checkOutId
        ? "Inspección CHECK_OUT registrada."
        : "Registre la inspección de salida antes de entregar.",
      status: checkOutId ? "done" : "pending",
      href: checkOutId
        ? `/dashboard/inspecciones/${checkOutId}?paso=inspeccion-salida`
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
        ? `/dashboard/inspecciones/${checkOutId}?paso=accesorios`
        : `/dashboard/inspecciones/nuevo?reservation_id=${reservationId}&type=CHECK_OUT`,
      linkLabel: checkOutId ? "Ver / Editar accesorios" : "Crear inspección",
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
      id: "facturacion",
      title: "Abonos",
      description:
        amountPaid > 0
          ? `Abonado: ${formatMoney(amountPaid)}`
          : "Registre el abono en la sección de recibos.",
      status: amountPaid > 0 ? "done" : "pending",
      href: `/dashboard/contratos/${contractId}?paso=facturacion`,
      linkLabel: amountPaid > 0 ? "Ver / Editar abonos" : "Ir a abonos",
    },
    {
      id: "pdf",
      title: "PDF del contrato",
      description: hasClientSignature
        ? "Firmado por el cliente — listo para ver y compartir."
        : "Vista interna disponible. Comparta solo después de la firma del cliente.",
      status: hasClientSignature ? "done" : "partial",
      href: `/dashboard/contratos/${contractId}?paso=pdf`,
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
  paso?: string | null;
}): string | undefined {
  if (input.onSignPage) return "firma";
  const paso = input.paso?.trim();
  if (
    paso === "cliente-vehiculo" ||
    paso === "inspeccion-salida" ||
    paso === "accesorios" ||
    paso === "firma" ||
    paso === "facturacion" ||
    paso === "pdf"
  ) {
    return paso;
  }
  if (input.inspectionType === "CHECK_OUT") {
    return (input.checkOutChecklistCount ?? 0) > 0
      ? "accesorios"
      : "inspeccion-salida";
  }
  return undefined;
}

export function firstIncompleteDeliveryStepId(
  steps: Array<{ id: string; status: string }>,
): string {
  const pending = steps.find((step) => step.status !== "done");
  return pending?.id ?? steps[0]?.id ?? "cliente-vehiculo";
}
