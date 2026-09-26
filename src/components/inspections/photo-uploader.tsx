"use client";

import { announceError } from "@/lib/ui/announce";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  deleteInspectionPhotoAction,
  uploadInspectionPhotoAction,
} from "@/app/dashboard/inspecciones/actions";
import { Button } from "@/components/ui/button";
import type { InspectionPhoto } from "@/types/database";

type PhotoUploaderProps = {
  inspectionId: string;
  photos: InspectionPhoto[];
  readOnly?: boolean;
};

async function compressImage(file: File, maxWidth = 1400): Promise<File> {
  if (!file.type.startsWith("image/") && file.type !== "") return file;

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

      const maxBytes = 900_000;
      let quality = 0.78;

      const finish = (blob: Blob | null) => {
        if (!blob) {
          resolve(file);
          return;
        }
        if (blob.size > maxBytes && quality > 0.45) {
          quality -= 0.08;
          canvas.toBlob(finish, "image/jpeg", quality);
          return;
        }
        resolve(
          new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
            type: "image/jpeg",
          }),
        );
      };

      canvas.toBlob(finish, "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function displaySrc(photo: InspectionPhoto) {
  if (photo.url) return photo.url;
  if (photo.storage_path.startsWith("data:")) return photo.storage_path;
  return null;
}

export function PhotoUploader({ inspectionId, photos, readOnly }: PhotoUploaderProps) {
  const router = useRouter();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [warning, setWarning] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleUploadBatch(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/") || file.type === "",
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
        fd.set("category", "OTHER");

        const result = await uploadInspectionPhotoAction(inspectionId, fd);
        if (!result.success) {
          failures.push(`${file.name}: ${result.error}`);
          continue;
        }
        ok += 1;
        if (result.data.warning) warnings.push(result.data.warning);
      } catch (err) {
        failures.push(
          `${file.name}: ${err instanceof Error ? err.message : "error al procesar"}`,
        );
      }
    }

    setUploading(false);
    setProgress(null);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";

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

  async function handleDelete(photo: InspectionPhoto, index: number) {
    if (
      !confirm(
        `¿Eliminar la foto ${index + 1}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeletingId(photo.id);
    setError(null);
    const result = await deleteInspectionPhotoAction(inspectionId, photo.id);
    setDeletingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
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
            Adjunte varias fotos desde la galería o tome fotos con la cámara.
            Se comprimen y suben de inmediato. Si subió una por error, elimínela
            con el botón en cada miniatura.
          </p>
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void handleUploadBatch(event.target.files);
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              void handleUploadBatch(event.target.files);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => galleryRef.current?.click()}
              loading={uploading}
              disabled={Boolean(deletingId)}
            >
              {uploading ? "Subiendo…" : "Adjuntar de galería"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading || Boolean(deletingId)}
            >
              Tomar foto
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
          {photos.map((photo, index) => {
            const src = displaySrc(photo);
            return (
              <figure
                key={photo.id}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={photo.caption ?? photo.file_name ?? `Foto ${index + 1}`}
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-surface-muted text-sm text-muted">
                    Foto {index + 1}
                    <br />
                    No se pudo previsualizar
                  </div>
                )}
                <figcaption className="space-y-2 p-3 text-sm">
                  <p className="font-medium">Foto {index + 1}</p>
                  {photo.file_name ? (
                    <p className="truncate text-muted">{photo.file_name}</p>
                  ) : null}
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="danger"
                      className="w-full"
                      loading={deletingId === photo.id}
                      disabled={uploading || Boolean(deletingId)}
                      onClick={() => void handleDelete(photo, index)}
                    >
                      Eliminar foto
                    </Button>
                  ) : null}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
