/**
 * Almacenamiento privado unificado.
 * Prioridad: Cloudflare R2 → Supabase Storage → data URL (dev).
 */
import { isR2Configured, isSupabaseAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  R2_PREFIX,
  buildR2Key,
  deleteFromR2,
  getR2SignedUrl,
  uploadToR2,
} from "@/lib/storage/r2";

export const SIGNATURES_BUCKET = "signatures";
export const INSPECTION_PHOTOS_BUCKET = "inspection-photos";

export type PrivateUploadResult = {
  storagePath: string;
  provider: "r2" | "supabase" | "inline";
  usedStorage: boolean;
  warning?: string;
};

export function dataUrlToBuffer(dataUrl: string): {
  buffer: Buffer;
  contentType: string;
} {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de imagen inválido.");
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function uploadSupabaseBucket(
  bucket: string,
  path: string,
  data: Buffer | Blob,
  contentType: string,
): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) return false;
  try {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(bucket).upload(path, data, {
      contentType,
      upsert: true,
    });
    return !error;
  } catch {
    return false;
  }
}

async function putPrivateObject(params: {
  r2Key: string;
  supabaseBucket: string;
  supabasePath: string;
  body: Buffer;
  contentType: string;
}): Promise<PrivateUploadResult> {
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: params.r2Key,
        body: params.body,
        contentType: params.contentType,
      });
      return {
        storagePath: `r2://${params.r2Key}`,
        provider: "r2",
        usedStorage: true,
      };
    } catch {
      // try supabase fallback
    }
  }

  const uploaded = await uploadSupabaseBucket(
    params.supabaseBucket,
    params.supabasePath,
    params.body,
    params.contentType,
  );

  if (uploaded) {
    return {
      storagePath: params.supabasePath,
      provider: "supabase",
      usedStorage: true,
      warning: isR2Configured()
        ? undefined
        : "Usando Supabase Storage temporalmente. Configure Cloudflare R2 para producción.",
    };
  }

  return {
    storagePath: `data:${params.contentType};base64,${params.body.toString("base64")}`,
    provider: "inline",
    usedStorage: false,
    warning:
      "Almacenamiento privado no configurado (R2 / Storage). Archivo en data URL temporal.",
  };
}

export async function uploadSignatureImage(
  contractId: string,
  signerType: string,
  dataUrl: string,
): Promise<PrivateUploadResult> {
  const extension = dataUrl.includes("image/jpeg") ? "jpg" : "png";
  const fileName = `${signerType.toLowerCase()}-${Date.now()}.${extension}`;
  const { buffer, contentType } = dataUrlToBuffer(dataUrl);

  return putPrivateObject({
    r2Key: buildR2Key(R2_PREFIX.signatures, contractId, fileName),
    supabaseBucket: SIGNATURES_BUCKET,
    supabasePath: `${contractId}/${fileName}`,
    body: buffer,
    contentType,
  });
}

export async function uploadInspectionPhoto(
  inspectionId: string,
  fileName: string,
  data: Buffer | Blob,
  contentType: string,
): Promise<PrivateUploadResult> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const name = `${Date.now()}-${safeName}`;
  const buffer =
    data instanceof Buffer
      ? data
      : Buffer.from(await (data as Blob).arrayBuffer());

  const primary = await putPrivateObject({
    r2Key: buildR2Key(R2_PREFIX.inspections, inspectionId, name),
    supabaseBucket: INSPECTION_PHOTOS_BUCKET,
    supabasePath: `${inspectionId}/${name}`,
    body: buffer,
    contentType,
  });

  if (primary.usedStorage) return primary;

  // Legacy bucket name used in older docs/setups
  const legacy = await putPrivateObject({
    r2Key: buildR2Key(R2_PREFIX.inspections, inspectionId, name),
    supabaseBucket: "inspections",
    supabasePath: `${inspectionId}/${name}`,
    body: buffer,
    contentType,
  });

  if (legacy.usedStorage) return legacy;

  // Tiny inline fallback only (avoid DB/PostgREST payload blow-ups)
  if (buffer.length <= 80_000) {
    return {
      storagePath: `data:${contentType};base64,${buffer.toString("base64")}`,
      provider: "inline",
      usedStorage: false,
      warning:
        "Almacenamiento privado no disponible. Foto guardada en modo temporal.",
    };
  }

  throw new Error(
    "No se pudo subir la foto: configure Cloudflare R2 o el bucket de Storage «inspection-photos».",
  );
}

export async function uploadPrivatePdf(params: {
  kind: "contracts" | "quotes";
  entityId: string;
  fileName: string;
  pdfBuffer: Buffer;
}): Promise<PrivateUploadResult> {
  const prefix =
    params.kind === "contracts" ? R2_PREFIX.contracts : R2_PREFIX.quotes;
  const bucket = params.kind;

  return putPrivateObject({
    r2Key: buildR2Key(prefix, params.entityId, params.fileName),
    supabaseBucket: bucket,
    supabasePath: `${params.entityId}/${params.fileName}`,
    body: params.pdfBuffer,
    contentType: "application/pdf",
  });
}

/** Resuelve una URL temporal para visualizar un archivo privado. */
export async function resolvePrivateFileUrl(
  storagePath: string,
  expiresInSeconds = 3600,
  options?: { bucket?: string },
): Promise<string | null> {
  if (!storagePath) return null;
  if (storagePath.startsWith("data:")) return storagePath;

  if (storagePath.startsWith("r2://")) {
    if (!isR2Configured()) return null;
    const key = storagePath.slice("r2://".length);
    return getR2SignedUrl(key, expiresInSeconds);
  }

  if (isSupabaseAdminConfigured()) {
    try {
      const admin = createAdminClient();
      const bucket =
        options?.bucket ??
        (storagePath.includes("signature")
          ? SIGNATURES_BUCKET
          : INSPECTION_PHOTOS_BUCKET);
      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrl(storagePath, expiresInSeconds);
      if (!error && data?.signedUrl) return data.signedUrl;

      // Legacy bucket name fallback for inspection photos
      if (bucket === INSPECTION_PHOTOS_BUCKET) {
        const alt = await admin.storage
          .from("inspections")
          .createSignedUrl(storagePath, expiresInSeconds);
        return alt.data?.signedUrl ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }

  return null;
}

/** Best-effort delete of a private object (R2 / Supabase / inline no-op). */
export async function deletePrivateObject(
  storagePath: string,
  options?: { bucket?: string },
): Promise<void> {
  if (!storagePath || storagePath.startsWith("data:")) return;

  if (storagePath.startsWith("r2://")) {
    if (!isR2Configured()) return;
    await deleteFromR2(storagePath.slice("r2://".length));
    return;
  }

  if (!isSupabaseAdminConfigured()) return;
  const admin = createAdminClient();
  const bucket = options?.bucket ?? INSPECTION_PHOTOS_BUCKET;
  const { error } = await admin.storage.from(bucket).remove([storagePath]);
  if (!error) return;
  if (bucket === INSPECTION_PHOTOS_BUCKET) {
    await admin.storage.from("inspections").remove([storagePath]);
  }
}
