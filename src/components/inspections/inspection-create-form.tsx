"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { createInspection } from "@/app/dashboard/inspecciones/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDatetimeLocalValue } from "@/lib/dates";
import { INSPECTION_TYPE_LABELS } from "@/lib/inspections/defaults";
import { FuelLevelPicker } from "@/components/inspections/fuel-level-picker";

type ReservationOption = {
  id: string;
  code: string;
  customerId: string;
  vehicleId: string;
  label: string;
};

type InspectionCreateFormProps = {
  reservations: ReservationOption[];
  initialReservationId?: string;
  initialType?: "CHECK_OUT" | "CHECK_IN";
};

export function InspectionCreateForm({
  reservations,
  initialReservationId,
  initialType = "CHECK_OUT",
}: InspectionCreateFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState(
    initialReservationId ?? reservations[0]?.id ?? "",
  );

  const selected = useMemo(
    () => reservations.find((r) => r.id === reservationId),
    [reservationId, reservations],
  );
  const vehicleId = selected?.vehicleId ?? "";
  const customerId = selected?.customerId ?? "";

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (!reservationId || !vehicleId || !customerId) {
      setError("Seleccione una reserva válida.");
      return;
    }
    formData.set("reservationId", reservationId);
    formData.set("vehicleId", vehicleId);
    formData.set("customerId", customerId);

    const result = await createInspection(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(`/dashboard/inspecciones/${result.data.id}`);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <Select
        label="Reserva *"
        value={reservationId}
        onChange={(event) => setReservationId(event.target.value)}
        options={reservations.map((reservation) => ({
          value: reservation.id,
          label: reservation.label,
        }))}
      />

      <Select
        label="Tipo de inspección *"
        name="type"
        defaultValue={initialType}
        options={Object.entries(INSPECTION_TYPE_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />

      <Input
        name="inspectionDate"
        label="Fecha y hora *"
        type="datetime-local"
        defaultValue={toDatetimeLocalValue(new Date())}
        required
      />
      <Input name="mileage" label="Kilometraje" type="number" min="0" />
      <FuelLevelPicker name="fuelLevel" />
      <Input
        name="handoverPersonName"
        label={
          initialType === "CHECK_OUT"
            ? "Quién recibe el vehículo (cliente/empresa)"
            : "Quién entrega el vehículo a OLDES"
        }
        placeholder="Ej. motorista, ingeniero, nombre de quien entrega/recibe"
      />
      <Input
        name="additionalDriverName"
        label="Conductor adicional (solo en entrega/devolución)"
        placeholder="Opcional — para empresas con distintos conductores"
      />
      <Textarea name="notes" label="Notas" rows={4} />

      <div className="flex flex-wrap gap-3">
        <SubmitButton>Crear inspección</SubmitButton>
        <Link
          href="/dashboard/inspecciones"
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
