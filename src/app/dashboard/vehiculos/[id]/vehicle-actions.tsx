"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  archiveVehicle,
  generateVehicleViewsFromPhoto,
  removeVehicleImage,
  setPrimaryVehicleImage,
  toggleVehiclePublished,
  updateVehicleImageView,
  uploadVehicleImage,
} from "@/app/dashboard/vehiculos/actions";
import { Button } from "@/components/ui/button";
import type { VehicleWithImages } from "@/app/dashboard/vehiculos/actions";
import { isGeneratedVehicleImage } from "@/lib/vehicles/generated-image";
import type { DamageView } from "@/types/database";

const VIEW_OPTIONS: Array<{ value: DamageView | ""; label: string }> = [
  { value: "", label: "Sin vista" },
  { value: "FRONT", label: "Frontal" },
  { value: "REAR", label: "Trasera" },
  { value: "LEFT", label: "Izquierda" },
  { value: "RIGHT", label: "Derecha" },
  { value: "TOP", label: "Superior" },
];

export function VehicleDetailActions({ vehicle }: { vehicle: VehicleWithImages }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [uploadView, setUploadView] = useState<DamageView | "">("FRONT");

  async function handleArchive() {
    const result = await archiveVehicle(vehicle.id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/vehiculos");
    router.refresh();
  }

  async function handleTogglePublished() {
    const next = !vehicle.published_on_web;
    const result = await toggleVehiclePublished(vehicle.id, next);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (next) {
      const typeLabel = result.data.typeName || vehicle.category || "el tipo";
      setInfo(
        `Publicado en la web como tipo «${typeLabel}» (tarifa y foto). La landing no muestra placas ni unidades individuales.`,
      );
    } else {
      setInfo("Unidad quitada de la web. El tipo se oculta solo si no queda otra unidad publicada.");
    }
    router.refresh();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setInfo(null);
    const fd = new FormData();
    fd.append("file", file);
    if (uploadView) fd.append("view", uploadView);
    const result = await uploadVehicleImage(vehicle.id, fd);
    setUploading(false);
    e.target.value = "";
    if (!result.success) setError(result.error);
    else {
      setInfo(
        "Foto subida. Pulsa «Generar vistas 3D» en esa foto para crear el diagrama técnico y las 5 vistas.",
      );
      router.refresh();
    }
  }

  async function handleGenerate(imageId: string) {
    setGeneratingId(imageId);
    setError(null);
    setInfo(null);
    const result = await generateVehicleViewsFromPhoto(vehicle.id, imageId);
    setGeneratingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setInfo(
      `Listo: plano de inspección estilo papel (sedán + pickup, código 0/+/X) generado desde la foto.`,
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {info}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Generar todo desde una foto</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Pulsa <strong>Generar vistas 3D</strong> en una foto: se crea el{" "}
          <strong>plano superior con paneles</strong> como el formulario físico
          (bumper, puertas, techo, palangana/baúl) y la leyenda{" "}
          <strong>0 = GOLPE · + = RAYON · x = FALTANTE</strong>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={handleTogglePublished}>
          {vehicle.published_on_web
            ? "Quitar de web"
            : "Publicar tipo en web"}
        </Button>
        <Button type="button" variant="danger" onClick={handleArchive}>
          Archivar
        </Button>
        <select
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          value={uploadView}
          onChange={(event) =>
            setUploadView(event.target.value as DamageView | "")
          }
          aria-label="Vista de la foto"
        >
          {VIEW_OPTIONS.map((option) => (
            <option key={option.value || "none"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50">
          {uploading ? "Subiendo…" : "Subir imagen"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {vehicle.images.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicle.images.map((img) => {
            const generated = isGeneratedVehicleImage(img.public_id);
            return (
              <div
                key={img.id}
                className="overflow-hidden rounded-lg border border-zinc-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  className="aspect-square w-full bg-slate-50 object-contain"
                />
                <div className="space-y-2 p-2">
                  {generated ? (
                    <span className="inline-flex rounded bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Generada 3D
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      loading={generatingId === img.id}
                      onClick={() => handleGenerate(img.id)}
                    >
                      {generatingId === img.id
                        ? "Generando vistas 3D…"
                        : "Generar vistas 3D desde esta foto"}
                    </Button>
                  )}
                  <select
                    className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
                    value={img.view ?? ""}
                    onChange={async (event) => {
                      const next = event.target.value as DamageView | "";
                      const r = await updateVehicleImageView(
                        img.id,
                        vehicle.id,
                        next || null,
                      );
                      if (!r.success) setError(r.error);
                      else router.refresh();
                    }}
                    aria-label="Asignar vista"
                  >
                    {VIEW_OPTIONS.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        Vista: {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    {img.is_primary ? (
                      <span className="text-xs font-medium text-green-700">
                        Principal
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-zinc-600 hover:underline"
                        onClick={async () => {
                          const r = await setPrimaryVehicleImage(
                            img.id,
                            vehicle.id,
                          );
                          if (r.success) router.refresh();
                        }}
                      >
                        Marcar principal
                      </button>
                    )}
                    <button
                      type="button"
                      className="ml-auto text-xs text-red-600 hover:underline"
                      onClick={async () => {
                        const r = await removeVehicleImage(img.id, vehicle.id);
                        if (r.success) router.refresh();
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
