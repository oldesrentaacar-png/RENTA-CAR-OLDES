import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, requireSupabasePublicEnv } from "@/lib/env";

export async function createClient(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase no está configurado. Defina NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const { url, anonKey } = requireSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies; middleware handles refresh.
        }
      },
    },
  });
}
