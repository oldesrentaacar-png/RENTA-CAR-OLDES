import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, requireSupabasePublicEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase no está configurado. Defina NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno.",
    );
  }

  const { url, anonKey } = requireSupabasePublicEnv();

  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }

  return browserClient;
}

export function resetBrowserClient(): void {
  browserClient = null;
}
