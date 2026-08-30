#!/usr/bin/env node
/**
 * Upsert fleet catalog types into Supabase (vehicle_types).
 * Run after migration 20260830000015_fleet_catalog_enhancements.sql
 *
 * Usage: node scripts/seed-fleet-catalog.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FLEET = [
  {
    slug: "sedan",
    name: "Sedán",
    name_en: "Sedan",
    description: "Económico y ágil. Perfecto para la ciudad y trayectos diarios.",
    description_en: "Economical and agile. Perfect for city driving and daily trips.",
    reference_models: "Nissan Sentra, Kia Soul o similar",
    reference_models_en: "Nissan Sentra, Kia Soul or similar",
    daily_rate: 32,
    passengers: 5,
    luggage: 2,
    transmission: "Automatic",
    image_url: "/landing/fleet/sedan.png",
    sort_order: 10,
  },
  {
    slug: "suv-2-row",
    name: "SUV 2 filas",
    name_en: "2 Row SUV",
    description: "Comodidad y altura ideal para explorar carreteras y playas.",
    description_en: "Comfort and ride height ideal for roads and beaches.",
    reference_models: "Nissan Rogue, Jeep Compass o similar",
    reference_models_en: "Nissan Rogue, Jeep Compass or similar",
    daily_rate: 39,
    passengers: 5,
    luggage: 3,
    transmission: "Automatic",
    image_url: "/landing/fleet/suv-2-row.png",
    sort_order: 20,
  },
  {
    slug: "suv-3-row",
    name: "SUV 3 filas",
    name_en: "3 Row SUV",
    description: "Amplio espacio interior para familias o viajes en grupo.",
    description_en: "Spacious interior for families or group travel.",
    reference_models: "Mitsubishi Outlander, Nissan Pathfinder o similar",
    reference_models_en: "Mitsubishi Outlander, Nissan Pathfinder or similar",
    daily_rate: 42,
    passengers: 7,
    luggage: 2,
    transmission: "Automatic",
    image_url: "/landing/fleet/suv-3-row.png",
    sort_order: 30,
  },
  {
    slug: "minivan",
    name: "Mini Van",
    name_en: "Mini Van",
    description: "Máximo confort, espacio y equipaje para grupos grandes.",
    description_en: "Maximum comfort, space and luggage for large groups.",
    reference_models: "Dodge Grand Caravan o similar",
    reference_models_en: "Dodge Grand Caravan or similar",
    daily_rate: 55,
    passengers: 7,
    luggage: 5,
    transmission: "Automatic",
    image_url: "/landing/fleet/minivan.png",
    sort_order: 40,
  },
  {
    slug: "pickup",
    name: "Pick Up",
    name_en: "Pick Up",
    description: "Potencia y capacidad de carga para cualquier terreno.",
    description_en: "Power and cargo capacity for any terrain.",
    reference_models: "Nissan NP300, Mitsubishi L200 o similar",
    reference_models_en: "Nissan NP300, Mitsubishi L200 or similar",
    daily_rate: 59,
    passengers: 5,
    luggage: 0,
    luggage_label: "Amplio espacio de carga abierta",
    luggage_label_en: "Large open cargo bed",
    transmission: "Automatic",
    image_url: "/landing/fleet/pickup.png",
    sort_order: 50,
  },
];

async function main() {
  await admin
    .from("vehicle_types")
    .update({ published_on_web: false, is_active: false })
    .ilike("slug", "%crossover%");

  for (const row of FLEET) {
    const payload = {
      ...row,
      features: ["A/C", "Seguro incluido"],
      published_on_web: true,
      is_active: true,
      deleted_at: null,
    };
    const { error } = await admin.from("vehicle_types").upsert(payload, {
      onConflict: "slug",
    });
    if (error) {
      console.error(`Failed ${row.slug}:`, error.message);
      process.exit(1);
    }
    console.log(`OK ${row.slug}`);
  }
  console.log("Fleet catalog seeded.");
}

main();
