"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateWebRequest } from "@/app/dashboard/solicitudes/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WebRequest } from "@/types/database";

type WebRequestEditFormProps = {
  request: WebRequest;
  vehicleCategories: string[];
};

export function WebRequestEditForm({
  request,
  vehicleCategories,
}: WebRequestEditFormProps) {
  const router = useRouter();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };

  const categoryOptions = [
    { value: "", label: "Sin especificar" },
    ...vehicleCategories.map((name) => ({ value: name, label: name })),
  ];
  if (
    request.vehicle_category &&
    !vehicleCategories.includes(request.vehicle_category)
  ) {
    categoryOptions.push({
      value: request.vehicle_category,
      label: `${request.vehicle_category} (actual)`,
    });
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await updateWebRequest(request.id, formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/solicitudes/${request.id}`);
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
        <Input
          name="firstName"
          label="Nombre *"
          defaultValue={request.first_name}
          required
        />
        <Input
          name="lastName"
          label="Apellido *"
          defaultValue={request.last_name}
          required
        />
        <Input
          name="phone"
          label="Teléfono *"
          defaultValue={request.phone}
          required
        />
        <Input
          name="email"
          label="Correo"
          type="email"
          defaultValue={request.email ?? ""}
        />
        <Input
          name="pickupDate"
          label="Fecha recogida *"
          type="date"
          defaultValue={request.pickup_date}
          required
        />
        <Input
          name="pickupTime"
          label="Hora recogida *"
          type="time"
          defaultValue={request.pickup_time?.slice(0, 5) || "00:00"}
          required
        />
        <Input
          name="returnDate"
          label="Fecha devolución *"
          type="date"
          defaultValue={request.return_date}
          required
        />
        <Input
          name="returnTime"
          label="Hora devolución *"
          type="time"
          defaultValue={request.return_time?.slice(0, 5) || "00:00"}
          required
        />
        <Select
          name="vehicleCategory"
          label="Tipo de vehículo"
          defaultValue={request.vehicle_category ?? ""}
          options={categoryOptions}
        />
        <Input
          name="pickupLocation"
          label="Lugar de recogida"
          defaultValue={request.pickup_location ?? ""}
        />
        <Input
          name="returnLocation"
          label="Lugar de devolución"
          defaultValue={request.return_location ?? ""}
        />
      </div>

      <Textarea
        name="notes"
        label="Notas"
        rows={4}
        defaultValue={request.notes ?? ""}
      />

      <div className="flex flex-wrap gap-3">
        <SubmitButton>Guardar cambios</SubmitButton>
        <Link
          href={`/dashboard/solicitudes/${request.id}`}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
