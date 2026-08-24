/**
 * Crea el primer administrador vía Auth Admin API + profile.
 * Uso: node --env-file=.env.local scripts/create-admin.mjs
 *
 * Requiere en .env.local:
 * ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile() {
  const p = path.join(root, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL?.trim();
const password = process.env.ADMIN_PASSWORD?.trim();
const firstName = process.env.ADMIN_FIRST_NAME?.trim() || "Admin";
const lastName = process.env.ADMIN_LAST_NAME?.trim() || "OLDES";

if (!url || !service) {
  console.error("Missing Supabase admin env.");
  process.exit(1);
}
if (!email || !password) {
  console.error("Missing ADMIN_EMAIL / ADMIN_PASSWORD.");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: roleRow, error: roleErr } = await admin
    .from("roles")
    .select("id, name, slug")
    .or("slug.eq.administrador,name.ilike.Administrador")
    .limit(1)
    .maybeSingle();

  if (roleErr || !roleRow) {
    console.error(
      "Rol Administrador no encontrado. Aplique migraciones/seed primero.",
      roleErr?.message,
    );
    process.exit(1);
  }

  let userId;
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = listed?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (error) throw error;
    console.log("Admin auth user updated.");
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log("Admin auth user created.");
  }

  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      first_name: firstName,
      last_name: lastName,
      email,
      role_id: roleRow.id,
      status: "ACTIVE",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (profileErr) {
    console.error("Profile upsert failed:", profileErr.message);
    process.exit(1);
  }

  console.log("Admin profile linked to role:", roleRow.name);
  console.log("DONE (email not printed).");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
