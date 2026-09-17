/**
 * Almacenamiento privado S3-compatible (Cloudflare R2 o Backblaze B2).
 * PDFs, firmas, fotos de inspección, comprobantes.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env, isR2Configured } from "@/lib/env";

let client: S3Client | null = null;

function resolveEndpoint(): string {
  if (env.R2_ENDPOINT) return env.R2_ENDPOINT;
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

/** B2: s3.us-west-004.backblazeb2.com → us-west-004. R2: auto. */
function resolveRegion(endpoint: string): string {
  if (env.R2_REGION) return env.R2_REGION;
  const b2 = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  if (b2) return b2[1];
  return "auto";
}

function isBackblazeEndpoint(endpoint: string): boolean {
  return /backblazeb2\.com/i.test(endpoint);
}

function getR2Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error(
      "Almacenamiento privado no configurado. Defina R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET y R2_ENDPOINT (Backblaze B2) o R2_ACCOUNT_ID (Cloudflare R2).",
    );
  }

  if (!client) {
    const endpoint = resolveEndpoint();
    const region = resolveRegion(endpoint);
    client = new S3Client({
      region,
      endpoint,
      // B2 S3 API is more reliable with path-style URLs.
      forcePathStyle: isBackblazeEndpoint(endpoint),
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  return client;
}

export function getR2Bucket(): string {
  return env.R2_BUCKET!;
}

/** Prefixes lógicos dentro del bucket */
export const R2_PREFIX = {
  contracts: "contracts",
  quotes: "quotes",
  signatures: "signatures",
  inspections: "inspections",
  receipts: "receipts",
  documents: "documents",
} as const;

export type R2Prefix = (typeof R2_PREFIX)[keyof typeof R2_PREFIX];

export async function uploadToR2(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ key: string }> {
  const s3 = getR2Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
  return { key: params.key };
}

export async function getR2SignedUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const s3 = getR2Client();
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export async function deleteFromR2(key: string): Promise<void> {
  const s3 = getR2Client();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
    }),
  );
}

export function buildR2Key(prefix: R2Prefix, ...parts: string[]): string {
  const safe = parts.map((p) => p.replace(/[^a-zA-Z0-9._/-]/g, "_"));
  return [prefix, ...safe].join("/");
}
