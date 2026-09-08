"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageCaptureFieldProps = {
  /** Hidden field that keeps the current stored URL when no new file is chosen */
  urlFieldName: string;
  label: string;
  currentUrl?: string | null;
  className?: string;
  onFileChange?: (file: File | null) => void;
};

export function ImageCaptureField({
  urlFieldName,
  label,
  currentUrl = null,
  className,
  onFileChange,
}: ImageCaptureFieldProps) {
  const inputId = useId();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [hasLocalFile, setHasLocalFile] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (hasLocalFile || cleared) return;
    setPreviewUrl(currentUrl);
  }, [currentUrl, hasLocalFile, cleared]);

  function applyFile(next: File | null) {
    if (!next || !next.type.startsWith("image/")) return;
    setCleared(false);
    setHasLocalFile(true);
    const objectUrl = URL.createObjectURL(next);
    setPreviewUrl(objectUrl);
    onFileChange?.(next);
  }

  function clearImage() {
    setHasLocalFile(false);
    setCleared(true);
    setPreviewUrl(null);
    onFileChange?.(null);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  const storedUrl = cleared || hasLocalFile ? "" : currentUrl || "";

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      <input type="hidden" name={urlFieldName} value={storedUrl} />

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            className="aspect-[4/3] w-full bg-white object-contain"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center px-4 text-center text-sm text-zinc-500">
            Sin foto. Suba una imagen o tome una con la cámara.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus className="mr-1.5 h-4 w-4" />
          Subir foto
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="mr-1.5 h-4 w-4" />
          Tomar foto
        </Button>
        {previewUrl ? (
          <Button type="button" variant="outline" size="sm" onClick={clearImage}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Quitar
          </Button>
        ) : null}
      </div>

      <input
        id={`${inputId}-gallery`}
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          applyFile(event.target.files?.[0] ?? null);
        }}
      />
      <input
        id={`${inputId}-camera`}
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          applyFile(event.target.files?.[0] ?? null);
        }}
      />
    </div>
  );
}
