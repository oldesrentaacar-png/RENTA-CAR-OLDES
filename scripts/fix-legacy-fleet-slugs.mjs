import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const slugsToHide = ["suv-2-filas", "suv-3-filas", "suv-crossover", "crossover"];

const { rowCount } = await client.query(
  `UPDATE public.vehicle_types
   SET published_on_web = false, is_active = false, updated_at = now()
   WHERE slug = ANY($1::text[])
     AND deleted_at IS NULL`,
  [slugsToHide],
);

console.log(`Deactivated ${rowCount} legacy fleet type(s).`);

const { rows } = await client.query(
  `SELECT slug, name, daily_rate, published_on_web, is_active
   FROM public.vehicle_types
   WHERE deleted_at IS NULL
   ORDER BY sort_order, name`,
);

console.log("All vehicle_types:");
for (const row of rows) {
  console.log(
    `- ${row.slug}: ${row.name} $${row.daily_rate} web=${row.published_on_web} active=${row.is_active}`,
  );
}

await client.end();
