import type { SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseAdminConfigured } from "@/lib/env";
import { mapPostgresError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Service role when configured so contracts.edit staff (Empleado) can
 * persist fleet status/odometer. User-client UPDATE on vehicles is 0 rows
 * without vehicles.edit; PostgREST reports that as success.
 */
export function operationalVehicleWriter(): SupabaseClient | null {
  return isSupabaseAdminConfigured() ? createAdminClient() : null;
}

export async function resolveVehicleWriter(
  fallback?: SupabaseClient,
): Promise<SupabaseClient> {
  return (
    operationalVehicleWriter() ?? fallback ?? ((await createClient()) as unknown as SupabaseClient)
  );
}

function isMissingVehiclesRelation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const msg = `${(error as { message?: string }).message ?? ""} ${(error as { code?: string }).code ?? ""}`.toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("42703") ||
    msg.includes("42p01")
  );
}

async function hasOtherOpenContract(
  writer: SupabaseClient,
  vehicleId: string,
  exceptContractId?: string | null,
): Promise<boolean> {
  let query = writer
    .from("contracts")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .is("deleted_at", null)
    .is("closed_at", null)
    .not("status", "in", '("COMPLETED","CANCELLED")')
    .limit(1);
  if (exceptContractId) {
    query = query.neq("id", exceptContractId);
  }
  const { data, error } = await query;
  if (error && !isMissingVehiclesRelation(error)) {
    throw mapPostgresError(error);
  }
  return (data?.length ?? 0) > 0;
}

/** Mark AVAILABLE and re-read the row. Never treat a 0-row RLS update as success. */
export async function persistVehicleAvailable(vehicleId: string): Promise<void> {
  const writer = await resolveVehicleWriter();
  const { data, error } = await writer
    .from("vehicles")
    .update({ status: "AVAILABLE" })
    .eq("id", vehicleId)
    .is("deleted_at", null)
    .select("id, status")
    .maybeSingle();

  if (error) {
    if (isMissingVehiclesRelation(error)) return;
    throw mapPostgresError(error);
  }
  if (!data) {
    throw new Error(
      "No se pudo marcar el vehículo como disponible. El perfil necesita permiso para actualizar el vehículo.",
    );
  }
}

/**
 * After closing or checking in one contract, free the vehicle only if no
 * other open contract still occupies it.
 */
export async function persistVehicleAvailableAfterContractClose(
  vehicleId: string,
  closedContractId: string,
): Promise<void> {
  const writer = await resolveVehicleWriter();
  if (await hasOtherOpenContract(writer, vehicleId, closedContractId)) {
    return;
  }
  await persistVehicleAvailable(vehicleId);
}

/** Cancel path: only touch RESERVED/RENTED. 0 rows is fine if already AVAILABLE. */
export async function releaseVehicleIfOccupied(vehicleId: string): Promise<void> {
  const writer = await resolveVehicleWriter();
  const { error } = await writer
    .from("vehicles")
    .update({ status: "AVAILABLE" })
    .eq("id", vehicleId)
    .in("status", ["RESERVED", "RENTED"])
    .is("deleted_at", null);
  if (error && !isMissingVehiclesRelation(error)) {
    throw mapPostgresError(error);
  }
}
