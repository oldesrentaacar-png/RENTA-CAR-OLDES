/**
 * Cloudflare R2 (S3-compatible) — almacenamiento privado definitivo.
 * PDFs, firmas, fotos de inspección, comprobantes.
 */
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env, isR2Configured } from "@/lib/env";

let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error(
      "Cloudflare R2 no está configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET.",
    );
  }

  if (!client) {
    const endpoint =
      env.R2_ENDPOINT ||
      `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    client = new S3Client({
      region: "auto",
      endpoint,
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

export function buildR2Key(prefix: R2Prefix, ...parts: string[]): string {
  const safe = parts.map((p) => p.replace(/[^a-zA-Z0-9._/-]/g, "_"));
  return [prefix, ...safe].join("/");
}
