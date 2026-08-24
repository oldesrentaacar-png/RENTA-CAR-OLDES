"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createMaintenanceRecord,
  updateMaintenanceRecord,
} from "@/app/dashboard/mantenimiento/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_TYPE_LABELS,
} from "@/lib/labels";
import type { MaintenanceRecord } from "@/types/database";

type MaintenanceFormProps = {
  record?: MaintenanceRecord;
  vehicles: Array<{ id: string; label: string }>;
  redirectTo?: string;
};

const MAINTENANCE_TYPES = Object.entries(MAINTENANCE_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const MAINTENANCE_STATUSES = Object.entries(MAINTENANCE_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function MaintenanceForm({
  record,
  vehicles,
  redirectTo,
}: MaintenanceFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(record?.status ?? "SCHEDULED");
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = Boolean(record);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = isEdit
      ? await updateMaintenanceRecord(record!.id, formData)
      : await createMaintenanceRecord(formData);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(
      redirectTo ??
        (isEdit
          ? `/dashboard/mantenimiento/${record!.id}`
          : "/dashboard/mantenimiento"),
    );
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          name="vehicleId"
          label="Vehículo *"
          defaultValue={record?.vehicle_id ?? ""}
          options={[
            { value: "", label: "Seleccione…" },
            ...vehicles.map((v) => ({ value: v.id, label: v.label })),
          ]}
          required
        />
        <Select
          name="type"
          label="Tipo *"
          defaultValue={record?.type ?? "GENERAL"}
          options={MAINTENANCE_TYPES}
          required
        />
        <Input
          name="maintenanceDate"
          label="Fecha *"
          type="date"
          defaultValue={record?.maintenance_date ?? today}
          required
        />
        <Select
          name="status"
          label="Estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          options={MAINTENANCE_STATUSES}
        />
        <Input
          name="description"
          label="Descripción *"
          defaultValue={record?.description}
          required
          className="sm:col-span-2"
        />
        <Input
          name="mileage"
          label="Kilometraje"
          type="number"
          min="0"
          defaultValue={record?.mileage ?? ""}
        />
        <Input
          name="cost"
          label="Costo"
          type="number"
          step="0.01"
          min="0"
          defaultValue={record?.cost ?? 0}
        />
        <Input
          name="workshop"
          label="Taller"
          defaultValue={record?.workshop ?? ""}
        />
        <Input
          name="nextDate"
          label="Próxima fecha"
          type="date"
          defaultValue={record?.next_date ?? ""}
        />
        <Input
          name="nextMileage"
          label="Próximo kilometraje"
          type="number"
          min="0"
          defaultValue={record?.next_mileage ?? ""}
        />
      </div>

      {status === "IN_PROGRESS" ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="setVehicleMaintenance" defaultChecked />
          Marcar vehículo en mantenimiento
        </label>
      ) : null}

      <Textarea
        name="notes"
        label="Notas"
        rows={3}
        defaultValue={record?.notes ?? ""}
      />

      <div className="flex gap-3">
        <SubmitButton>
          {isEdit ? "Guardar cambios" : "Registrar mantenimiento"}
        </SubmitButton>
        <Link
          href="/dashboard/mantenimiento"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
