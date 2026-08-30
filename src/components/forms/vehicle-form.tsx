"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, parseMoneyInput, toNumber, multiply } from "@/lib/money";
import type { Vehicle, VehicleOwnershipType } from "@/types/database";
import {
  createVehicle,
  updateVehicle,
} from "@/app/dashboard/vehiculos/actions";

type VehicleTypeOption = {
  id: string;
  name: string;
  daily_rate: number;
};

type VehicleFormProps = {
  vehicle?: Vehicle;
  vehicleTypes?: VehicleTypeOption[];
};

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "RESERVED", label: "Reservado" },
  { value: "RENTED", label: "Rentado" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
  { value: "UNAVAILABLE", label: "No disponible" },
];

const OWNERSHIP_OPTIONS = [
  { value: "OWN", label: "Propio" },
  { value: "THIRD_PARTY", label: "Terceros" },
  { value: "SUBLEASED", label: "Subarrendado" },
  { value: "CONSIGNMENT", label: "Consignación" },
];

export function VehicleForm({ vehicle, vehicleTypes = [] }: VehicleFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(vehicle);
  const [ownershipType, setOwnershipType] = useState<VehicleOwnershipType>(
    vehicle?.ownership_type ?? "OWN",
  );
  const [dailyRate, setDailyRate] = useState(
    vehicle?.daily_rate != null ? String(vehicle.daily_rate) : "",
  );
  const [weeklyRate, setWeeklyRate] = useState(
    vehicle?.weekly_rate != null ? String(vehicle.weekly_rate) : "",
  );
  const [weeklyTouched, setWeeklyTouched] = useState(Boolean(vehicle?.weekly_rate));

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("dailyRate", String(parseMoneyInput(dailyRate)));
    if (weeklyRate !== "") {
      formData.set("weeklyRate", String(parseMoneyInput(weeklyRate)));
    }
    formData.set(
      "deposit",
      String(parseMoneyInput(formData.get("deposit"), 0)),
    );
    if (weeklyRate.trim() === "") {
      formData.delete("weeklyRate");
    }

    const result = isEdit
      ? await updateVehicle(vehicle!.id, formData)
      : await createVehicle(formData);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(`/dashboard/vehiculos/${result.data.id}`);
    router.refresh();
  }

  const typeOptions = [
    { value: "", label: vehicleTypes.length ? "Sin tipo de catálogo" : "Sin tipos cargados" },
    ...vehicleTypes.map((type) => ({
      value: type.id,
      label: `${type.name} (${formatMoney(type.daily_rate)}/día)`,
    })),
  ];

  return (
    <form action={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input name="brand" label="Marca *" defaultValue={vehicle?.brand} required />
        <Input name="model" label="Modelo *" defaultValue={vehicle?.model} required />
        <Input name="year" label="Año *" type="number" defaultValue={vehicle?.year} required />
        <Input name="plate" label="Placa *" defaultValue={vehicle?.plate} required />
        <Input name="category" label="Categoría" defaultValue={vehicle?.category ?? ""} />
        <Select
          name="vehicleTypeId"
          label="Tipo de vehículo (catálogo web)"
          defaultValue={vehicle?.vehicle_type_id ?? ""}
          options={typeOptions}
        />
        <Input name="color" label="Color" defaultValue={vehicle?.color ?? ""} />
        <Input name="vin" label="VIN" defaultValue={vehicle?.vin ?? ""} />
        <Input name="chassis" label="Chasis" defaultValue={vehicle?.chassis ?? ""} />
        <Input name="engine" label="Motor" defaultValue={vehicle?.engine ?? ""} />
        <Input
          name="engineOil"
          label="Aceite de motor"
          defaultValue={vehicle?.engine_oil ?? ""}
          placeholder="Ej. 5W-30 sintético"
        />
        <Input
          name="tireInfo"
          label="Información de llantas"
          defaultValue={vehicle?.tire_info ?? ""}
          placeholder="Ej. 215/60 R16"
        />
        <Input
          name="currentMileage"
          label="Kilometraje actual"
          type="number"
          min="0"
          defaultValue={vehicle?.current_mileage ?? ""}
        />
        <Input
          name="transmission"
          label="Transmisión"
          defaultValue={vehicle?.transmission ?? "Automatic"}
        />
        <Input
          name="fuelType"
          label="Combustible"
          defaultValue={vehicle?.fuel_type ?? "Gasoline"}
        />
        <Input
          name="passengers"
          label="Pasajeros"
          type="number"
          defaultValue={vehicle?.passengers ?? 5}
        />
        <Input name="doors" label="Puertas" type="number" defaultValue={vehicle?.doors ?? 4} />
        <Input
          name="luggage"
          label="Equipaje"
          type="number"
          defaultValue={vehicle?.luggage ?? 2}
        />
        <Input
          name="dailyRate"
          label="Tarifa diaria (USD) *"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={dailyRate}
          onChange={(e) => {
            const next = e.target.value;
            setDailyRate(next);
            if (!weeklyTouched) {
              const daily = parseMoneyInput(next);
              setWeeklyRate(daily > 0 ? String(toNumber(multiply(daily, 7))) : "");
            }
          }}
          required
        />
        <div className="space-y-1">
          <Input
            name="weeklyRate"
            label="Tarifa semanal (USD)"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={weeklyRate}
            onChange={(e) => {
              setWeeklyTouched(true);
              setWeeklyRate(e.target.value);
            }}
          />
          <p className="text-xs text-muted">
            Se calcula sola como 7 × tarifa diaria
            {dailyRate
              ? ` (${formatMoney(parseMoneyInput(dailyRate))} × 7)`
              : ""}
            . Puede editarla si necesita otra cifra.
          </p>
        </div>
        <Input
          name="deposit"
          label="Depósito / garantía (USD)"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          defaultValue={vehicle?.deposit ?? 0}
        />
        <Select
          name="ownershipType"
          label="Tipo de propiedad"
          defaultValue={vehicle?.ownership_type ?? "OWN"}
          value={ownershipType}
          onChange={(event) =>
            setOwnershipType(event.target.value as VehicleOwnershipType)
          }
          options={OWNERSHIP_OPTIONS}
        />
        <Select
          name="status"
          label="Estado"
          defaultValue={vehicle?.status ?? "AVAILABLE"}
          options={STATUS_OPTIONS}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="airConditioning"
          defaultChecked={vehicle?.air_conditioning ?? true}
          className="rounded border-zinc-300"
        />
        Aire acondicionado
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="publishedOnWeb"
          defaultChecked={vehicle?.published_on_web ?? false}
          className="rounded border-zinc-300"
        />
        Publicar en web
      </label>

      <Textarea
        name="publicDescription"
        label="Descripción pública"
        defaultValue={vehicle?.public_description ?? ""}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="ownerName" label="Nombre propietario" defaultValue={vehicle?.owner_name ?? ""} />
        <Input name="ownerPhone" label="Tel. propietario" defaultValue={vehicle?.owner_phone ?? ""} />
      </div>
      {ownershipType === "SUBLEASED" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="mb-3 text-sm font-medium text-amber-950">
            Subarrendado — costo diario a tercero (ganancia no real)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="subleaseDailyCost"
              label="Costo por día de renta (USD)"
              type="number"
              step="0.01"
              min="0"
              defaultValue={vehicle?.sublease_daily_cost ?? ""}
              placeholder="Ej. 30"
            />
            <Input
              name="subleasePayeeName"
              label="Destinatario del pago"
              defaultValue={vehicle?.sublease_payee_name ?? ""}
              placeholder="Ej. Josue"
            />
          </div>
        </div>
      ) : null}
      <Textarea
        name="internalNotes"
        label="Notas internas"
        defaultValue={vehicle?.internal_notes ?? ""}
      />

      <div className="flex gap-3">
        <SubmitButton>{isEdit ? "Guardar cambios" : "Crear vehículo"}</SubmitButton>
        <Link
          href={vehicle ? `/dashboard/vehiculos/${vehicle.id}` : "/dashboard/vehiculos"}
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
