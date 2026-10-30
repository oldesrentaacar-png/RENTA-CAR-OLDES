import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseAdminConfigured } from "@/lib/env";
import { mapPostgresError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * After assertPermission, writes go through the service role so RLS USING
 * cannot return success with 0 rows. Session client is the fallback only.
 */
export function staffWriter(session: SupabaseClient): SupabaseClient {
  return isSupabaseAdminConfigured() ? createAdminClient() : session;
}

export function requireSaved<T>(
  result: { data: T | null; error: PostgrestError | null },
  message: string,
): T {
  if (result.error) throw mapPostgresError(result.error);
  if (result.data == null) {
    throw new Error(message);
  }
  return result.data;
}
