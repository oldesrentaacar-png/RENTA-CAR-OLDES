/**
 * Smoke test: sube y lee un objeto en B2/R2 (S3-compatible).
 * Uso: node --env-file=.env.local scripts/verify-private-storage.mjs
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucket =
  process.env.R2_BUCKET?.trim() || process.env.R2_BUCKET_NAME?.trim();
const endpoint =
  process.env.R2_ENDPOINT?.trim() ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`
    : undefined);
const regionEnv = process.env.R2_REGION?.trim();

if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
  console.error(
    "Faltan vars: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT (o R2_ACCOUNT_ID).",
  );
  process.exit(1);
}

const b2Match = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
const region = regionEnv || (b2Match ? b2Match[1] : "auto");
const forcePathStyle = /backblazeb2\.com/i.test(endpoint);

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle,
  credentials: { accessKeyId, secretAccessKey },
});

const key = `diagnostics/verify-${Date.now()}.txt`;
const body = Buffer.from(`oldes-private-storage-ok ${new Date().toISOString()}`);

try {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "text/plain",
    }),
  );

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 120 },
  );

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

  console.log("OK — almacenamiento privado responde.");
  console.log(`  bucket: ${bucket}`);
  console.log(`  endpoint: ${endpoint}`);
  console.log(`  region: ${region}`);
  console.log(`  forcePathStyle: ${forcePathStyle}`);
  console.log(`  signedUrl (sample): ${url.slice(0, 72)}...`);
} catch (err) {
  console.error("FAIL — no se pudo usar el bucket:", err?.message || err);
  process.exit(1);
}
