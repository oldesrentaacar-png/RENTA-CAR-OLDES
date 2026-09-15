"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateInspection } from "@/app/dashboard/inspecciones/actions";
import { FuelLevelPicker } from "@/components/inspections/fuel-level-picker";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toDatetimeLocalValue } from "@/lib/dates";
import { INSPECTION_TYPE_LABELS } from "@/lib/inspections/defaults";
import type { FuelLevel, InspectionType } from "@/types/database";

type InspectionEditFormProps = {
  inspectionId: string;
  code: string;
  type: InspectionType;
  inspectionDate: string;
  mileage: number | null;
  fuelLevel: FuelLevel | null;
  handoverPersonName: string | null;
  additionalDriverName: string | null;
  notes: string | null;
  reservationLabel: string;
  vehicleLabel: string;
  customerName: string;
};

export function InspectionEditForm({
  inspectionId,
  code,
  type,
  inspectionDate,
  mileage,
  fuelLevel,
  handoverPersonName,
  additionalDriverName,
  notes,
  reservationLabel,
  vehicleLabel,
  customerName,
}: InspectionEditFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await updateInspection(inspectionId, formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/inspecciones/${inspectionId}`);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm">
        <p>
          <span className="text-muted">Código:</span> {code}
        </p>
        <p>
          <span className="text-muted">Tipo:</span>{" "}
          {INSPECTION_TYPE_LABELS[type] ?? type}
        </p>
        <p>
          <span className="text-muted">Reserva:</span> {reservationLabel}
        </p>
        <p>
          <span className="text-muted">Cliente:</span> {customerName}
        </p>
        <p>
          <span className="text-muted">Vehículo:</span> {vehicleLabel}
        </p>
      </div>

      <Input
        name="inspectionDate"
        label="Fecha y hora *"
        type="datetime-local"
        defaultValue={toDatetimeLocalValue(new Date(inspectionDate))}
        required
      />
      <Input
        name="mileage"
        label="Kilometraje"
        type="number"
        min="0"
        defaultValue={mileage ?? ""}
      />
      <FuelLevelPicker
        name="fuelLevel"
        defaultValue={fuelLevel ?? ""}
      />
      <Input
        name="handoverPersonName"
        label={
          type === "CHECK_OUT"
            ? "Quién recibe el vehículo (cliente/empresa)"
            : "Quién entrega el vehículo a OLDES"
        }
        defaultValue={handoverPersonName ?? ""}
        placeholder="Ej. motorista, ingeniero, nombre de quien entrega/recibe"
      />
      <Input
        name="additionalDriverName"
        label="Conductor adicional (solo en entrega/devolución)"
        defaultValue={additionalDriverName ?? ""}
        placeholder="Opcional — para empresas con distintos conductores"
      />
      <Textarea
        name="notes"
        label="Notas"
        rows={4}
        defaultValue={notes ?? ""}
      />

      <div className="flex flex-wrap gap-3">
        <SubmitButton>Guardar cambios</SubmitButton>
        <Link
          href={`/dashboard/inspecciones/${inspectionId}`}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
        >
          Cancelar
        </Link>
        <Link
          href={`/dashboard/inspecciones/${inspectionId}#accesorios`}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
        >
          Ir a accesorios / daños
        </Link>
      </div>
    </form>
  );
}
