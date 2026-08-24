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

      <form
        action={handleCreate}
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input name="name" label="Nombre *" placeholder="SUV 2 filas" required />
        <Input
          name="dailyRate"
          label="Tarifa diaria *"
          type="number"
          step="0.01"
          min="0"
          required
        />
        <Input name="passengers" label="Pasajeros" type="number" defaultValue={5} />
        <Input name="luggage" label="Equipaje" type="number" defaultValue={2} />
        <Input name="imageUrl" label="URL de imagen" />
        <Input name="sortOrder" label="Orden" type="number" defaultValue={0} />
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="publishedOnWeb"
            className="rounded border-zinc-300"
          />
          Publicado en web
        </label>
        <div className="flex items-end">
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
                className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <Input name="name" label="Nombre *" defaultValue={item.name} required />
                <Input
                  name="dailyRate"
                  label="Tarifa diaria *"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={item.daily_rate}
                  required
                />
                <Input
                  name="passengers"
                  label="Pasajeros"
                  type="number"
                  defaultValue={item.passengers}
                />
                <Input
                  name="luggage"
                  label="Equipaje"
                  type="number"
                  defaultValue={item.luggage}
                />
                <Input
                  name="imageUrl"
                  label="URL de imagen"
                  defaultValue={item.image_url ?? ""}
                />
                <Input
                  name="sortOrder"
                  label="Orden"
                  type="number"
                  defaultValue={item.sort_order}
                />
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    name="publishedOnWeb"
                    defaultChecked={item.published_on_web}
                    className="rounded border-zinc-300"
                  />
                  Publicado en web
                </label>
                <div className="flex items-end gap-2">
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
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted">
                    {formatMoney(item.daily_rate)}/día · {item.passengers} pax ·{" "}
                    {item.luggage} maletas · orden {item.sort_order}
                    {item.published_on_web ? " · web" : " · oculto"}
                  </p>
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
