import type { SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseAdminConfigured } from "@/lib/env";
import { mapPostgresError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function reservationWriter(
  fallback?: SupabaseClient,
): Promise<SupabaseClient> {
  if (isSupabaseAdminConfigured()) return createAdminClient();
  if (fallback) return fallback;
  return (await createClient()) as unknown as SupabaseClient;
}

/** CHECK_OUT: CONFIRMED → ACTIVE. 0 rows is fine if already ACTIVE. */
export async function markReservationActive(
  reservationId: string,
): Promise<void> {
  const writer = await reservationWriter();
  const { error } = await writer
    .from("reservations")
    .update({ status: "ACTIVE" })
    .eq("id", reservationId)
    .eq("status", "CONFIRMED")
    .is("deleted_at", null);
  if (error) throw mapPostgresError(error);
}
