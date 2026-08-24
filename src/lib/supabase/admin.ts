import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseAdminConfigured, requireSupabaseAdminEnv } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      "Supabase admin no está configurado. Defina NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!adminClient) {
    const { url, serviceRoleKey } = requireSupabaseAdminEnv();
    adminClient = createSupabaseClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

export function resetAdminClient(): void {
  adminClient = null;
}
