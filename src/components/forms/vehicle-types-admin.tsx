"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createVehicleType,
  deactivateVehicleType,
  updateVehicleType,
} from "@/app/dashboard/configuracion/tipos-vehiculo/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import type { VehicleType } from "@/types/database";

type VehicleTypesAdminProps = {
  items: VehicleType[];
  tableReady: boolean;
};

function FleetTypeFields({
  item,
}: {
  item?: VehicleType;
}) {
  return (
    <>
      <Input
        name="name"
        label="Nombre (ES) *"
        defaultValue={item?.name}
        placeholder="Sedán"
        required
      />
      <Input
        name="nameEn"
        label="Nombre (EN)"
        defaultValue={item?.name_en ?? ""}
        placeholder="Sedan"
      />
      <Input
        name="dailyRate"
        label="Tarifa diaria *"
        type="number"
        step="0.01"
        min="0"
        defaultValue={item?.daily_rate ?? ""}
        required
      />
      <Input
        name="sortOrder"
        label="Orden"
        type="number"
        defaultValue={item?.sort_order ?? 0}
      />
      <Input
        name="referenceModels"
        label="Vehículos de referencia (ES)"
        defaultValue={item?.reference_models ?? ""}
        placeholder="Nissan Sentra, Kia Soul o similar"
      />
      <Input
        name="referenceModelsEn"
        label="Vehículos de referencia (EN)"
        defaultValue={item?.reference_models_en ?? ""}
      />
      <Input
        name="description"
        label="Descripción (ES)"
        defaultValue={item?.description ?? ""}
      />
      <Input
        name="descriptionEn"
        label="Descripción (EN)"
        defaultValue={item?.description_en ?? ""}
      />
      <Input
        name="transmission"
        label="Transmisión"
        defaultValue={item?.transmission ?? "Automatic"}
      />
      <Input
        name="passengers"
        label="Cantidad de asientos"
        type="number"
        defaultValue={item?.passengers ?? 5}
      />
      <Input
        name="luggage"
        label="Maletas (número)"
        type="number"
        defaultValue={item?.luggage ?? 2}
      />
      <Input
        name="luggageLabel"
        label="Texto equipaje alternativo (ES)"
        defaultValue={item?.luggage_label ?? ""}
        placeholder="Amplio espacio de carga abierta"
      />
      <Input
        name="luggageLabelEn"
        label="Texto equipaje alternativo (EN)"
        defaultValue={item?.luggage_label_en ?? ""}
      />
      <Input
        name="imageUrl"
        label="URL de imagen"
        defaultValue={item?.image_url ?? ""}
        placeholder="/landing/fleet/sedan.png"
      />
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          name="publishedOnWeb"
          defaultChecked={item?.published_on_web ?? true}
          className="rounded border-zinc-300"
        />
        Publicado en web
      </label>
    </>
  );
}

export function VehicleTypesAdmin({
  items,
  tableReady,
}: VehicleTypesAdminProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setError(null);
    formData.set(
      "dailyRate",
      String(parseMoneyInput(formData.get("dailyRate"), 0)),
    );
    const result = await createVehicleType(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleUpdate(id: string, formData: FormData) {
    setError(null);
    formData.set(
      "dailyRate",
      String(parseMoneyInput(formData.get("dailyRate"), 0)),
    );
    const result = await updateVehicleType(id, formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDeactivate(id: string) {
    setError(null);
    const result = await deactivateVehicleType(id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!tableReady) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        La tabla <code>vehicle_types</code> aún no está disponible. Aplique la
        migración correspondiente para administrar el catálogo de landing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <p className="text-sm text-muted">
        Catálogo público por categoría (no unidades individuales). La landing
        lee estos tipos desde la base de datos.
      </p>

      <form
        action={handleCreate}
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FleetTypeFields />
        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <SubmitButton>Agregar tipo</SubmitButton>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted">
          No hay tipos de vehículo. Agregue al menos uno para el catálogo público.
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {items.map((item) =>
            editingId === item.id ? (
              <form
                key={item.id}
                action={(fd) => handleUpdate(item.id, fd)}
                className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <FleetTypeFields item={item} />
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                  <SubmitButton>Guardar</SubmitButton>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-14 w-20 shrink-0 rounded-lg border border-zinc-200 object-cover"
                    />
                  ) : null}
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted">
                      {formatMoney(item.daily_rate)}/día · {item.passengers}{" "}
                      asientos · orden {item.sort_order}
                      {item.published_on_web ? " · web" : " · oculto"}
                    </p>
                    {item.reference_models ? (
                      <p className="text-xs text-muted">{item.reference_models}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingId(item.id)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeactivate(item.id)}
                  >
                    Desactivar
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
