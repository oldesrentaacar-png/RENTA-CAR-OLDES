/**
 * Apply optional IVA columns on contracts.
 * Usage: node --env-file=.env.local scripts/apply-optional-iva-migration.mjs
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260916000007_contract_optional_iva.sql",
);

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("Falta DATABASE_URL en .env.local");
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log("OK — apply_iva / tax_rate / tax_amount en contracts.");
} finally {
  await client.end();
}
