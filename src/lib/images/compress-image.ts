/** Client-side: any photo → web-ready JPEG (size, format, orientation). */

export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  quality?: number;
};

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i;

function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (!file.type && IMAGE_EXTENSIONS.test(file.name)) return true;
  return IMAGE_EXTENSIONS.test(file.name);
}

function isHeicLike(file: File): boolean {
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  return (
    t.includes("heic") ||
    t.includes("heif") ||
    n.endsWith(".heic") ||
    n.endsWith(".heif")
  );
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo adaptar la imagen."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

async function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la imagen.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function loadAsBitmap(file: Blob): Promise<ImageBitmap> {
  // Respect EXIF orientation when the browser supports it.
  try {
    return await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
  } catch {
    return await createImageBitmap(file);
  }
}

async function loadAsHtmlImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = url;
  });
}

/**
 * Adapta CUALQUIER imagen usable del teléfono/PC a JPEG web:
 * orientación correcta, máximo 1600px, ~1.2 MB o menos.
 */
export async function adaptImageForUpload(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  if (!looksLikeImage(file)) {
    throw new Error(
      "El archivo no parece una imagen. Use JPG, PNG, WEBP o una foto de la cámara.",
    );
  }

  if (isHeicLike(file)) {
    // Intentamos igual; si el navegador no lo abre, mensaje claro.
    try {
      await loadAsBitmap(file);
    } catch {
      throw new Error(
        "Este iPhone envió HEIC y el navegador no lo puede convertir. En el teléfono: Ajustes → Cámara → Formatos → Más compatible, o elija «Subir foto» en JPG.",
      );
    }
  }

  const maxWidth = options.maxWidth ?? 1600;
  const maxHeight = options.maxHeight ?? 1600;
  const maxBytes = options.maxBytes ?? 1_200_000;
  let quality = options.quality ?? 0.84;

  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await loadAsBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } catch {
    const img = await loadAsHtmlImage(file);
    source = img;
    width = img.naturalWidth || img.width;
    height = img.naturalHeight || img.height;
  }

  if (!width || !height) {
    bitmap?.close();
    throw new Error("La imagen está vacía o dañada.");
  }

  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  let canvas: HTMLCanvasElement;
  try {
    canvas = await drawToCanvas(source, targetW, targetH);
  } finally {
    bitmap?.close();
  }

  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  // Still too big? scale down again.
  if (blob.size > maxBytes) {
    const shrink = Math.sqrt(maxBytes / blob.size) * 0.92;
    const w2 = Math.max(1, Math.round(targetW * shrink));
    const h2 = Math.max(1, Math.round(targetH * shrink));
    const smaller = await drawToCanvas(canvas, w2, h2);
    blob = await canvasToBlob(smaller, "image/jpeg", 0.72);
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "vehiculo";
  return new File([blob], `${baseName}-web.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/** @deprecated use adaptImageForUpload */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  return adaptImageForUpload(file, options);
}

export function isBlobFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "size" in value &&
    typeof (value as Blob).size === "number" &&
    (value as Blob).size > 0
  );
}
