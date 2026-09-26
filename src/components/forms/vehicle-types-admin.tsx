"use client";

import { announceError } from "@/lib/ui/announce";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createVehicleType,
  deactivateVehicleType,
  getVehicleTypeImageUploadParams,
  reactivateVehicleType,
  updateVehicleType,
} from "@/app/dashboard/configuracion/tipos-vehiculo/actions";
import { ImageCaptureField } from "@/components/forms/image-capture-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prepareVehicleTypeImageFormData } from "@/lib/images/upload-vehicle-type-image";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import type { VehicleType } from "@/types/database";

type VehicleTypesAdminProps = {
  items: VehicleType[];
  tableReady: boolean;
};

function FleetTypeFields({
  item,
  onImageFileChange,
}: {
  item?: VehicleType;
  onImageFileChange?: (file: File | null) => void;
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
      <div className="sm:col-span-2 lg:col-span-3">
        <ImageCaptureField
          urlFieldName="imageUrl"
          label="Imagen del tipo (cualquier foto — se adapta sola)"
          currentUrl={item?.image_url}
          onFileChange={onImageFileChange}
          autoAdapt
        />
        <p className="mt-1 text-xs text-muted">
          Elija o tome una foto. El sistema la convierte a formato web, la
          reduce y la sube sin errores por peso. Luego pulse Guardar.
          Marque <strong>Publicado en web</strong> para que el tipo y la
          imagen aparezcan en la landing.
        </p>
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input type="hidden" name="publishedOnWebField" value="1" />
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
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  async function handleCreate(formData: FormData) {
    setError(null);
    try {
      formData.set(
        "dailyRate",
        String(parseMoneyInput(formData.get("dailyRate"), 0)),
      );
      await prepareVehicleTypeImageFormData(
        formData,
        createImageFile,
        getVehicleTypeImageUploadParams,
      );
      const result = await createVehicleType(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCreateImageFile(null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar. Pruebe otra imagen o revise la tarifa diaria.",
      );
    }
  }

  async function handleUpdate(id: string, formData: FormData) {
    setError(null);
    try {
      formData.set(
        "dailyRate",
        String(parseMoneyInput(formData.get("dailyRate"), 0)),
      );
      await prepareVehicleTypeImageFormData(
        formData,
        editImageFile,
        getVehicleTypeImageUploadParams,
      );
      const result = await updateVehicleType(id, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditImageFile(null);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar. Pruebe otra imagen o revise la tarifa diaria.",
      );
    }
  }

  async function handleDeactivate(id: string) {
    const ok = window.confirm(
      "¿Desactivar este tipo de vehículo?\n\nDejará de aparecer en el catálogo y en la web. No se puede desactivar si aún tiene vehículos asignados. Podrá reactivarlo después desde la lista de desactivados.",
    );
    if (!ok) return;

    setError(null);
    const result = await deactivateVehicleType(id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleReactivate(id: string) {
    const ok = window.confirm(
      "¿Reactivar este tipo de vehículo?\n\nVolverá al catálogo activo (oculto en web hasta que lo publique).",
    );
    if (!ok) return;

    setError(null);
    const result = await reactivateVehicleType(id);
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

  const activeItems = items.filter((item) => !item.deleted_at);
  const deactivatedItems = items.filter((item) => Boolean(item.deleted_at));

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <p className="text-sm text-muted">
        Catálogo público por categoría (no unidades individuales). La landing
        lee estos tipos desde la base de datos. Marque «Publicar en web» al
        editar para que aparezca en el sitio.
      </p>

      <form
        action={handleCreate}
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FleetTypeFields onImageFileChange={setCreateImageFile} />
        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <SubmitButton>Agregar tipo</SubmitButton>
        </div>
      </form>

      {activeItems.length === 0 ? (
        <p className="text-sm text-muted">
          No hay tipos de vehículo activos. Agregue al menos uno para el
          catálogo público.
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {activeItems.map((item) =>
            editingId === item.id ? (
              <form
                key={item.id}
                action={(fd) => handleUpdate(item.id, fd)}
                className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <FleetTypeFields
                  item={item}
                  onImageFileChange={setEditImageFile}
                />
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                  <SubmitButton>Guardar</SubmitButton>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(null);
                      setEditImageFile(null);
                    }}
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
                    onClick={() => {
                      setEditImageFile(null);
                      setEditingId(item.id);
                    }}
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

      {deactivatedItems.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-800">
            Tipos desactivados
          </h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
            {deactivatedItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-700">{item.name}</p>
                  <p className="text-xs text-muted">
                    {formatMoney(item.daily_rate)}/día · desactivado
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleReactivate(item.id)}
                >
                  Reactivar
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
