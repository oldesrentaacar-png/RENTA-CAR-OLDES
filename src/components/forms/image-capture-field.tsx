"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { adaptImageForUpload } from "@/lib/images/compress-image";
import { cn } from "@/lib/utils";

type ImageCaptureFieldProps = {
  /** Hidden field that keeps the current stored URL when no new file is chosen */
  urlFieldName: string;
  /**
   * Optional named file input. Prefer leaving unset for vehicle types so the
   * huge original never rides in the Server Action FormData.
   */
  fileFieldName?: string;
  label: string;
  currentUrl?: string | null;
  className?: string;
  /** Called with the adapted (compressed) file ready for Cloudinary upload */
  onFileChange?: (file: File | null) => void;
  /** Auto-adapt any phone/PC image to web JPEG on select (default true) */
  autoAdapt?: boolean;
};

export function ImageCaptureField({
  urlFieldName,
  fileFieldName,
  label,
  currentUrl = null,
  className,
  onFileChange,
  autoAdapt = true,
}: ImageCaptureFieldProps) {
  const inputId = useId();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [hasLocalFile, setHasLocalFile] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (hasLocalFile || cleared) return;
    setPreviewUrl(currentUrl);
  }, [currentUrl, hasLocalFile, cleared]);

  function syncNamedFileInput(next: File | null) {
    if (!fileFieldName) return;
    const input = galleryRef.current;
    if (!input) return;
    if (!next) {
      input.value = "";
      return;
    }
    try {
      const transfer = new DataTransfer();
      transfer.items.add(next);
      input.files = transfer.files;
    } catch {
      // ignore
    }
  }

  async function applyFile(raw: File | null) {
    if (!raw) return;
    setLocalError(null);
    setBusy(true);
    try {
      const next = autoAdapt ? await adaptImageForUpload(raw) : raw;
      setCleared(false);
      setHasLocalFile(true);
      const objectUrl = URL.createObjectURL(next);
      setPreviewUrl(objectUrl);
      syncNamedFileInput(next);
      onFileChange?.(next);
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "No se pudo preparar la imagen. Pruebe otra foto.",
      );
      onFileChange?.(null);
    } finally {
      setBusy(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  function clearImage() {
    setHasLocalFile(false);
    setCleared(true);
    setPreviewUrl(null);
    setLocalError(null);
    syncNamedFileInput(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    onFileChange?.(null);
  }

  const storedUrl = cleared || hasLocalFile ? "" : currentUrl || "";

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      <input type="hidden" name={urlFieldName} value={storedUrl} />
      <input
        type="hidden"
        name={`${urlFieldName}Cleared`}
        value={cleared ? "1" : "0"}
      />

      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            className="aspect-[4/3] w-full bg-white object-contain"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center px-4 text-center text-sm text-zinc-500">
            Sin foto. Suba cualquier imagen; el sistema la adapta sola.
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-zinc-800">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Adaptando imagen…
          </div>
        ) : null}
      </div>

      {localError ? (
        <p className="text-xs text-red-700">{localError}</p>
      ) : (
        <p className="text-xs text-muted">
          JPG, PNG, WEBP o cámara. Se redimensiona y comprime automáticamente.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus className="mr-1.5 h-4 w-4" />
          Subir foto
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="mr-1.5 h-4 w-4" />
          Tomar foto
        </Button>
        {previewUrl ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={clearImage}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Quitar
          </Button>
        ) : null}
      </div>

      <input
        id={`${inputId}-gallery`}
        ref={galleryRef}
        type="file"
        name={fileFieldName}
        accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif,.bmp"
        className="hidden"
        onChange={(event) => {
          void applyFile(event.target.files?.[0] ?? null);
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
          void applyFile(event.target.files?.[0] ?? null);
        }}
      />
    </div>
  );
}
