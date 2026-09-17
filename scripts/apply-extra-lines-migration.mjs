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
  "20260916000008_contract_extra_line_items.sql",
);

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(fs.readFileSync(sqlPath, "utf8"));
  console.log("OK — contracts.extra_line_items");
} finally {
  await client.end();
}
