/**
 * Full pilot audit — DB + env + storage + critical invariants.
 * Usage: node --env-file=.env.local scripts/full-pilot-audit.mjs
 */
import pg from "pg";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const rows = [];
const push = (area, item, status, detail = "") => {
  rows.push({ area, item, status, detail });
};

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  // --- Roles / Visitante / calendar.view ---
  const visit = await client.query(
    `select id, name from public.roles where name = 'Visitante' limit 1`,
  );
  if (visit.rowCount) {
    push("RBAC", "Rol Visitante", "PASS", visit.rows[0].id);
    const perms = await client.query(
      `
      select p.key
      from public.role_permissions rp
      join public.permissions p on p.id = rp.permission_id
      where rp.role_id = $1
      order by p.key
      `,
      [visit.rows[0].id],
    );
    const codes = perms.rows.map((r) => r.key);
    const hasCal = codes.includes("calendar.view");
    push(
      "RBAC",
      "Visitante permissions",
      hasCal ? "PASS" : "FAIL",
      codes.join(", ") || "(none)",
    );
    // Visitante should be calendar-focused; warn if many write perms
    const writeish = codes.filter((c) =>
      /\.(create|edit|delete|sign|cancel)$/.test(c),
    );
    push(
      "RBAC",
      "Visitante sin writes peligrosos",
      writeish.length === 0 ? "PASS" : "WARN",
      writeish.join(", ") || "ok",
    );
  } else {
    push("RBAC", "Rol Visitante", "FAIL", "no existe");
  }

  const calPerm = await client.query(
    `select 1 from public.permissions where key = 'calendar.view'`,
  );
  push(
    "RBAC",
    "permission calendar.view",
    calPerm.rowCount ? "PASS" : "FAIL",
  );

  // --- Customers unique active ---
  const idx = await client.query(`
    select indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'customers'
      and (
        indexdef ilike '%unique%'
        or indexname ilike '%unique%'
        or indexname ilike '%active%'
      )
  `);
  push(
    "Clientes",
    "Índices unique/activos",
    idx.rowCount > 0 ? "PASS" : "WARN",
    idx.rows.map((r) => r.indexname).join(", ") || "none",
  );

  const ghosts = await client.query(`
    select count(*)::int as n
    from public.customers
    where deleted_at is not null
  `);
  push(
    "Clientes",
    "Soft-deleted presentes",
    "INFO",
    String(ghosts.rows[0].n),
  );

  // --- Document code RPC ---
  const seq = await client.query(`
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'next_document_code'
  `);
  push(
    "Códigos",
    "next_document_code",
    seq.rowCount ? "PASS" : "FAIL",
    seq.rows.map((r) => `${r.proname}(${r.args})`).join(" | "),
  );

  // --- Signature upsert ---
  const upsert = await client.query(`
    select 1 from pg_proc where proname = 'upsert_contract_signature'
  `);
  push(
    "Firmas",
    "RPC upsert_contract_signature",
    upsert.rowCount ? "PASS" : "FAIL",
  );

  // --- Inspections path_points ---
  const pathCol = await client.query(`
    select 1 from information_schema.columns
    where table_schema='public' and table_name='inspection_damage_marks'
      and column_name='path_points'
  `);
  push(
    "Inspecciones",
    "path_points column",
    pathCol.rowCount ? "PASS" : "FAIL",
  );

  // --- Contract IVA + extras ---
  for (const col of [
    "apply_iva",
    "tax_rate",
    "tax_amount",
    "extra_line_items",
  ]) {
    const r = await client.query(
      `
      select 1 from information_schema.columns
      where table_schema='public' and table_name='contracts' and column_name=$1
      `,
      [col],
    );
    push("Contrato/PDF", `contracts.${col}`, r.rowCount ? "PASS" : "FAIL");
  }

  // Sample contract data quality for PDF fields
  const sample = await client.query(`
    select c.code, c.apply_iva, c.tax_amount, c.extra_line_items,
           c.delivered_by_name, c.received_by_name,
           i.handover_person_name, i.fuel_level,
           cu.customer_type, cu.company_name, cu.nit, cu.nrc, cu.receiver_name
    from public.contracts c
    join public.customers cu on cu.id = c.customer_id
    left join public.inspections i
      on i.reservation_id = c.reservation_id and i.type = 'CHECK_OUT'
    where c.deleted_at is null
    order by c.created_at desc
    limit 5
  `);
  const withHandover = sample.rows.filter((r) => r.handover_person_name).length;
  const withFuel = sample.rows.filter((r) => r.fuel_level).length;
  push(
    "Contrato/PDF",
    "Muestra reciente (handover/fuel)",
    sample.rowCount ? "PASS" : "WARN",
    `n=${sample.rowCount} handover=${withHandover} fuel=${withFuel} sample=${sample.rows
      .map((r) => r.code)
      .join(",")}`,
  );

  // Soft-deleted holding codes risk: check archive columns exist if migration applied
  const archiveCols = await client.query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema='public'
      and column_name in ('archived_code','code_archived_at')
    order by 1,2
  `);
  push(
    "Códigos",
    "Columnas archive (si aplica)",
    archiveCols.rowCount > 0 ? "PASS" : "INFO",
    archiveCols.rows.map((r) => `${r.table_name}.${r.column_name}`).join(", ") ||
      "no archive columns found",
  );
} finally {
  await client.end();
}

// --- Env ---
const need = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "CRON_SECRET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];
for (const k of need) {
  const v = process.env[k]?.trim();
  push("Env local", k, v ? "PASS" : "FAIL", v ? `len=${v.length}` : "missing");
}

// --- B2 ---
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
  const key = `diagnostics/audit-${Date.now()}.txt`;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET.trim(),
      Key: key,
      Body: Buffer.from("audit-ok"),
      ContentType: "text/plain",
    }),
  );
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET.trim(),
      Key: key,
    }),
  );
  push("B2", "upload/delete", "PASS", process.env.R2_BUCKET);
} catch (e) {
  push("B2", "upload/delete", "FAIL", e.message || String(e));
}

// --- Resend API ping (lightweight) ---
try {
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}` },
  });
  push(
    "Resend",
    "API key válida",
    res.ok || res.status === 200 ? "PASS" : "WARN",
    `HTTP ${res.status}`,
  );
} catch (e) {
  push("Resend", "API key válida", "FAIL", e.message || String(e));
}

// Print report
const order = [
  "RBAC",
  "Clientes",
  "Códigos",
  "Firmas",
  "Inspecciones",
  "Contrato/PDF",
  "Env local",
  "B2",
  "Resend",
];
console.log("=== FULL PILOT AUDIT ===");
for (const area of order) {
  const subset = rows.filter((r) => r.area === area);
  if (!subset.length) continue;
  console.log(`\n## ${area}`);
  for (const r of subset) {
    console.log(`[${r.status}] ${r.item}${r.detail ? ` — ${r.detail}` : ""}`);
  }
}
const fail = rows.filter((r) => r.status === "FAIL").length;
const warn = rows.filter((r) => r.status === "WARN").length;
console.log(`\n=== SUMMARY fail=${fail} warn=${warn} total=${rows.length} ===`);
if (fail > 0) process.exitCode = 1;
