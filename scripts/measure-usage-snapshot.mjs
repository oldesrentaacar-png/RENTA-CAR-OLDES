/**
 * Snapshot of measurable usage for capacity planning.
 * Usage: node --env-file=.env.local scripts/measure-usage-snapshot.mjs
 */
import pg from "pg";
import {
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const out = { at: new Date().toISOString(), supabase: {}, b2: {}, env: {} };

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  const db = await client.query(
    "select pg_database_size(current_database())::bigint as bytes",
  );
  const tables = await client.query(`
    select relname as name, pg_total_relation_size(c.oid)::bigint as bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by 2 desc
    limit 12
  `);
  const counts = await client.query(`
    select
      (select count(*)::int from contracts where deleted_at is null) as contracts,
      (select count(*)::int from customers where deleted_at is null) as customers,
      (select count(*)::int from reservations where deleted_at is null) as reservations,
      (select count(*)::int from inspection_photos) as insp_photos,
      (select count(*)::int from contract_signatures) as signatures,
      (select count(*)::int from vehicles where deleted_at is null) as vehicles,
      (select count(*)::int from quotes where deleted_at is null) as quotes
  `);
  const dbBytes = Number(db.rows[0].bytes);
  const freeDb = 500 * 1024 * 1024;
  out.supabase = {
    dbBytes,
    dbMb: +(dbBytes / 1024 / 1024).toFixed(2),
    freeLimitMb: 500,
    pctOfFree: +((dbBytes / freeDb) * 100).toFixed(2),
    tables: tables.rows.map((r) => ({
      name: r.name,
      mb: +(Number(r.bytes) / 1024 / 1024).toFixed(3),
    })),
    counts: counts.rows[0],
  };
} finally {
  await client.end();
}

try {
  const endpoint = process.env.R2_ENDPOINT.trim();
  const region =
    process.env.R2_REGION?.trim() ||
    endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i)?.[1] ||
    "auto";
  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: /backblazeb2\.com/i.test(endpoint),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
    },
  });
  let token;
  let bytes = 0;
  let objects = 0;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET.trim(),
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      bytes += obj.Size ?? 0;
      objects += 1;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  const freeB2 = 10 * 1024 * 1024 * 1024;
  out.b2 = {
    bucket: process.env.R2_BUCKET,
    objects,
    bytes,
    mb: +(bytes / 1024 / 1024).toFixed(2),
    freeLimitGb: 10,
    pctOfFree: +((bytes / freeB2) * 100).toFixed(3),
  };
} catch (e) {
  out.b2 = { error: e.message || String(e) };
}

out.env = {
  resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
  cloudinaryConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME?.trim()),
  cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
};

// Pilot evidence from docs/propuesta (last measured in console screenshots)
out.pilotEvidence = {
  vercelFastDataTransferGb: 3,
  vercelFastDataTransferLimitGb: 100,
  vercelEdgeRequests: 25000,
  vercelEdgeRequestsLimit: 1000000,
  vercelOriginTransferMb: 330,
  vercelOriginTransferLimitGb: 10,
  cloudinaryCreditsUsed: 0.01,
  cloudinaryCreditsLimit: 25,
};

console.log(JSON.stringify(out, null, 2));
