/**
 * Aplica migraciones SQL en orden contra Postgres de Supabase.
 * Uso: node --env-file=.env.local scripts/apply-migrations.mjs
 *
 * Requiere: SUPABASE_DB_PASSWORD (o DATABASE_URL completa)
 * NO imprime secretos.
 */
import { readdir, readFile } from "fs/promises";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

function buildDatabaseUrlCandidates() {
  const candidates = [];

  if (process.env.DATABASE_URL?.trim()) {
    candidates.push(process.env.DATABASE_URL.trim());
  }

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const ref =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
      /https:\/\/([a-z0-9]+)\.supabase\.co/,
    )?.[1];

  if (!password || !ref) {
    if (candidates.length) return candidates;
    throw new Error(
      "Falta SUPABASE_DB_PASSWORD (Database password del proyecto) o DATABASE_URL.",
    );
  }

  const encoded = encodeURIComponent(password);
  const regions = [
    "ca-central-1",
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "eu-west-1",
    "eu-central-1",
    "ap-southeast-1",
    "sa-east-1",
  ];

  candidates.push(
    `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`,
  );

  for (const region of regions) {
    candidates.push(
      `postgresql://postgres.${ref}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
    );
    candidates.push(
      `postgresql://postgres.${ref}:${encoded}@aws-1-${region}.pooler.supabase.com:5432/postgres`,
    );
    candidates.push(
      `postgresql://postgres.${ref}:${encoded}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
    );
  }

  return [...new Set(candidates)];
}

async function connectClient() {
  const candidates = buildDatabaseUrlCandidates();
  let lastError;

  for (const connectionString of candidates) {
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
    const host = connectionString.includes("@")
      ? connectionString.split("@")[1].split("/")[0]
      : "unknown";
    try {
      await client.connect();
      console.log(`Connected via ${host}`);
      return client;
    } catch (err) {
      lastError = err;
      console.log(
        `Failed ${host}: ${err.code || "ERR"} ${String(err.message).slice(0, 100)}`,
      );
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
  }

  throw lastError ?? new Error("No se pudo conectar a Supabase Postgres.");
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function main() {
  console.log("Connecting to Supabase Postgres...");
  const client = await connectClient();

  await ensureMigrationsTable(client);

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration files.`);

  for (const file of files) {
    const { rows } = await client.query(
      "SELECT 1 FROM public.schema_migrations WHERE id = $1",
      [file],
    );
    if (rows.length) {
      console.log(`SKIP ${file}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`APPLY ${file}...`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO public.schema_migrations (id) VALUES ($1)",
        [file],
      );
      await client.query("COMMIT");
      console.log(`OK ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`FAIL ${file}: ${err.message}`);
      throw err;
    }
  }

  await client.end();
  console.log("All migrations applied.");
}

main().catch((err) => {
  console.error("Migration runner failed:", err.message);
  process.exit(1);
});
