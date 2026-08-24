/**
 * Almacenamiento privado unificado.
 * Prioridad: Cloudflare R2 → Supabase Storage → data URL (dev).
 */
import { isR2Configured, isSupabaseAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  R2_PREFIX,
  buildR2Key,
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

  return putPrivateObject({
    r2Key: buildR2Key(R2_PREFIX.inspections, inspectionId, name),
    supabaseBucket: INSPECTION_PHOTOS_BUCKET,
    supabasePath: `${inspectionId}/${name}`,
    body: buffer,
    contentType,
  });
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
): Promise<string | null> {
  if (!storagePath) return null;
  if (storagePath.startsWith("data:")) return storagePath;

  if (storagePath.startsWith("r2://")) {
    if (!isR2Configured()) return null;
    const key = storagePath.slice("r2://".length);
    return getR2SignedUrl(key, expiresInSeconds);
  }

  // Rutas legacy de Supabase Storage
  if (isSupabaseAdminConfigured()) {
    try {
      const admin = createAdminClient();
      const bucket = storagePath.includes("inspection")
        ? INSPECTION_PHOTOS_BUCKET
        : SIGNATURES_BUCKET;
      const { data } = await admin.storage
        .from(bucket)
        .createSignedUrl(storagePath, expiresInSeconds);
      return data?.signedUrl ?? null;
    } catch {
      return null;
    }
  }

  return null;
}
