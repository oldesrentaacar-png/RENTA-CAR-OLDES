import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin
  .from("vehicle_types")
  .select("slug,name,daily_rate,reference_models,image_url,published_on_web")
  .eq("published_on_web", true)
  .eq("is_active", true)
  .order("sort_order");

if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}

console.log(`Published fleet types: ${data.length}`);
for (const row of data) {
  console.log(`- ${row.slug}: ${row.name} $${row.daily_rate} | ${row.reference_models}`);
}
