"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { uploadInspectionPhotoAction } from "@/app/dashboard/inspecciones/actions";
import { Button } from "@/components/ui/button";
import type { InspectionPhoto } from "@/types/database";

type PhotoUploaderProps = {
  inspectionId: string;
  photos: InspectionPhoto[];
  readOnly?: boolean;
};

async function compressImage(file: File, maxWidth = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function photoSrc(path: string) {
  if (path.startsWith("data:")) return path;
  return path;
}

export function PhotoUploader({ inspectionId, photos, readOnly }: PhotoUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleUploadBatch(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length === 0) {
      setError("Seleccione solo imágenes.");
      return;
    }

    setUploading(true);
    setError(null);
    setWarning(null);

    let ok = 0;
    const failures: string[] = [];
    const warnings: string[] = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      setProgress(`Subiendo ${index + 1} de ${files.length}…`);
      try {
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.set("file", compressed);
        // Entrega rápida en parqueo: sin categoría por foto.
        fd.set("category", "OTHER");

        const result = await uploadInspectionPhotoAction(inspectionId, fd);
        if (!result.success) {
          failures.push(`${file.name}: ${result.error}`);
          continue;
        }
        ok += 1;
        if (result.data.warning) warnings.push(result.data.warning);
      } catch {
        failures.push(`${file.name}: error al procesar`);
      }
    }

    setUploading(false);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";

    if (failures.length > 0) {
      setError(
        ok > 0
          ? `Se subieron ${ok}. Fallaron ${failures.length}: ${failures[0]}`
          : failures[0] ?? "No se pudieron subir las fotos.",
      );
    }
    if (warnings.length > 0) setWarning(warnings[0] ?? null);

    if (ok > 0) router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {warning ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </div>
      ) : null}

      {!readOnly ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm text-muted">
            Seleccione varias fotos a la vez (por ejemplo 10). Se suben de
            inmediato, sin categoría ni descripción por foto — pensado para
            entrega rápida en parqueo.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={(event) => {
              void handleUploadBatch(event.target.files);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              loading={uploading}
            >
              {uploading ? "Subiendo…" : "Adjuntar fotos"}
            </Button>
            {progress ? (
              <span className="text-sm text-muted">{progress}</span>
            ) : (
              <span className="text-sm text-muted">
                {photos.length} foto{photos.length === 1 ? "" : "s"} en esta
                inspección
              </span>
            )}
          </div>
        </div>
      ) : null}

      {photos.length === 0 ? (
        <p className="text-sm text-muted">Sin fotos registradas.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <figure
              key={photo.id}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              {photo.storage_path.startsWith("data:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoSrc(photo.storage_path)}
                  alt={photo.caption ?? photo.file_name ?? `Foto ${index + 1}`}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-surface-muted text-sm text-muted">
                  Foto {index + 1}
                  <br />
                  {photo.file_name ?? "Archivo privado"}
                </div>
              )}
              <figcaption className="p-3 text-sm">
                <p className="font-medium">Foto {index + 1}</p>
                {photo.file_name ? (
                  <p className="truncate text-muted">{photo.file_name}</p>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
