import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);
if (!match) {
  console.error("NO_DATABASE_URL");
  process.exit(1);
}

const connectionString = match[1].trim();
const sql = fs.readFileSync(
  "supabase/migrations/20260915000023_fix_permissions_inspection_vehicle_ops.sql",
  "utf8",
);

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("MIGRATION_OK");
  const r = await client.query(
    "select proname from pg_proc where proname in ('get_user_permissions','has_permission') order by 1",
  );
  console.log("FUNCS", r.rows.map((x) => x.proname).join(","));
} catch (e) {
  await client.query("ROLLBACK");
  console.error("MIGRATION_FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end();
}
