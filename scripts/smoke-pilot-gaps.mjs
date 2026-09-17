/**
 * Smoke checks against live DB + B2 (no UI login).
 * node --env-file=.env.local scripts/smoke-pilot-gaps.mjs
 */
import pg from "pg";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const results = [];

function ok(name, detail = "") {
  results.push(`OK  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

await client.connect();

try {
  const cols = await client.query(`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='contracts'
      and column_name in ('apply_iva','tax_rate','tax_amount','extra_line_items')
    order by 1`);
  const names = cols.rows.map((r) => r.column_name);
  for (const need of ["apply_iva", "tax_rate", "tax_amount", "extra_line_items"]) {
    if (names.includes(need)) ok(`db.contracts.${need}`);
    else fail(`db.contracts.${need}`);
  }

  const rpc = await client.query(
    `select 1 from pg_proc where proname='upsert_contract_signature'`,
  );
  if (rpc.rowCount) ok("rpc.upsert_contract_signature");
  else fail("rpc.upsert_contract_signature");

  const sample = await client.query(`
    select c.id, c.code, c.apply_iva, c.tax_amount, c.extra_line_items,
           i.handover_person_name, i.fuel_level
    from contracts c
    left join inspections i on i.reservation_id = c.reservation_id and i.type = 'CHECK_OUT'
    where c.deleted_at is null
    order by c.created_at desc
    limit 1`);
  if (sample.rowCount) {
    const row = sample.rows[0];
    ok(
      "sample_contract",
      `${row.code} apply_iva=${row.apply_iva} fuel=${row.fuel_level ?? "null"} handover=${row.handover_person_name ?? "null"}`,
    );
  } else {
    fail("sample_contract", "no contracts");
  }
} finally {
  await client.end();
}

const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucket = process.env.R2_BUCKET?.trim();
const endpoint = process.env.R2_ENDPOINT?.trim();
if (accessKeyId && secretAccessKey && bucket && endpoint) {
  const region =
    process.env.R2_REGION?.trim() ||
    endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i)?.[1] ||
    "auto";
  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: /backblazeb2\.com/i.test(endpoint),
    credentials: { accessKeyId, secretAccessKey },
  });
  const key = `diagnostics/smoke-${Date.now()}.txt`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from("smoke"),
        ContentType: "text/plain",
      }),
    );
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    ok("b2.upload_delete");
  } catch (e) {
    fail("b2.upload_delete", e.message || String(e));
  }
} else {
  fail("b2.config", "missing R2_*");
}

const resend = Boolean(process.env.RESEND_API_KEY?.trim());
const emailFrom = Boolean(process.env.EMAIL_FROM?.trim());
const cron = Boolean(process.env.CRON_SECRET?.trim());
if (resend && emailFrom) ok("resend.env");
else fail("resend.env", `key=${resend} from=${emailFrom}`);
if (cron) ok("cron_secret.env");
else fail("cron_secret.env");

console.log(results.join("\n"));
if (results.some((l) => l.startsWith("FAIL"))) process.exitCode = 1;
