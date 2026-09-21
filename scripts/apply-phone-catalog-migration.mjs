import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);
if (!match) {
  console.error("NO_DATABASE_URL");
  process.exit(1);
}
const databaseUrl = match[1].trim().replace(/^["']|["']$/g, "");
const sqlPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260920000001_client_phone_dup_and_extras_catalog.sql",
);

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(fs.readFileSync(sqlPath, "utf8"));
  const idx = await client.query(
    "SELECT indexname FROM pg_indexes WHERE indexname = 'uq_customers_phone_active'",
  );
  const cats = await client.query(
    `SELECT code, name_es, unit_price
     FROM quote_catalog_items
     WHERE code IN ('CHILD_SEAT','DRIVER','DELIVERY','FUEL','INTL_INSURANCE','EXIT_PERMIT')
       AND deleted_at IS NULL
     ORDER BY sort_order`,
  );
  console.log("phone_index_exists=", idx.rowCount > 0);
  console.log("catalog_rows=", cats.rows);
  console.log("MIGRATION_OK");
} finally {
  await client.end();
}
