"use client";

import { useRef, useState } from "react";

import { uploadInspectionPhotoAction } from "@/app/dashboard/inspecciones/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PHOTO_CATEGORY_LABELS } from "@/lib/inspections/defaults";
import type { InspectionPhoto, InspectionPhotoCategory } from "@/types/database";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<InspectionPhotoCategory>("FRONT");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    setWarning(null);

    const compressed = await compressImage(file);
    const fd = new FormData();
    fd.set("file", compressed);
    fd.set("category", category);
    if (caption) fd.set("caption", caption);

    const result = await uploadInspectionPhotoAction(inspectionId, fd);
    setUploading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    if (result.data.warning) setWarning(result.data.warning);
    setCaption("");
    window.location.reload();
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
        <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
          <Select
            label="Categoría"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as InspectionPhotoCategory)
            }
            options={Object.entries(PHOTO_CATEGORY_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Input
            label="Descripción"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <div className="flex items-end">
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              loading={uploading}
            >
              Subir foto
            </Button>
          </div>
        </div>
      ) : null}

      {photos.length === 0 ? (
        <p className="text-sm text-muted">Sin fotos registradas.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              {photo.storage_path.startsWith("data:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoSrc(photo.storage_path)}
                  alt={photo.caption ?? photo.file_name ?? "Foto"}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-surface-muted text-sm text-muted">
                  {PHOTO_CATEGORY_LABELS[photo.category] ?? photo.category}
                  <br />
                  {photo.file_name ?? photo.storage_path}
                </div>
              )}
              <figcaption className="p-3 text-sm">
                <p className="font-medium">
                  {PHOTO_CATEGORY_LABELS[photo.category] ?? photo.category}
                </p>
                {photo.caption ? (
                  <p className="text-muted">{photo.caption}</p>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
