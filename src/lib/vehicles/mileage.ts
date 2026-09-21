import type { createClient } from "@/lib/supabase/server";
import { mapPostgresError } from "@/lib/errors";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type MileageSource = "CHECK_OUT" | "CHECK_IN" | "MANUAL" | "MAINTENANCE";

function isMissingRelationOrColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const msg = `${(error as { message?: string }).message ?? ""} ${(error as { code?: string }).code ?? ""}`.toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("42703") ||
    msg.includes("42p01") ||
    msg.includes("vehicle_mileage_history") ||
    msg.includes("current_mileage")
  );
}

/**
 * Persist current vehicle odometer + optional history row.
 * Does not roll back the vehicle if the new reading is lower than current.
 */
export async function applyVehicleMileage(
  supabase: SupabaseServer,
  input: {
    vehicleId: string;
    mileage: number;
    source: MileageSource;
    userId: string;
    inspectionId?: string | null;
    contractId?: string | null;
    notes?: string | null;
  },
): Promise<{ updated: boolean; previous: number | null }> {
  const mileage = Number(input.mileage);
  if (!Number.isInteger(mileage) || mileage < 0 || mileage > 9_999_999) {
    throw new Error("Kilometraje inválido.");
  }

  const { data: vehicle, error: vehicleReadError } = await supabase
    .from("vehicles")
    .select("current_mileage")
    .eq("id", input.vehicleId)
    .maybeSingle();

  if (vehicleReadError && !isMissingRelationOrColumn(vehicleReadError)) {
    throw mapPostgresError(vehicleReadError);
  }

  const previous =
    (vehicle as { current_mileage?: number | null } | null)?.current_mileage !=
    null
      ? Number(
          (vehicle as { current_mileage: number | null }).current_mileage,
        )
      : null;

  const shouldUpdateVehicle = previous == null || mileage >= previous;

  if (shouldUpdateVehicle) {
    const { error: updateError } = await supabase
      .from("vehicles")
      .update({
        current_mileage: mileage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.vehicleId);

    if (updateError) {
      if (isMissingRelationOrColumn(updateError)) {
        return { updated: false, previous };
      }
      throw mapPostgresError(updateError);
    }
  }

  const { error: historyError } = await supabase
    .from("vehicle_mileage_history")
    .insert({
      vehicle_id: input.vehicleId,
      mileage,
      source: input.source,
      inspection_id: input.inspectionId ?? null,
      contract_id: input.contractId ?? null,
      notes:
        input.notes ??
        (!shouldUpdateVehicle && previous != null
          ? `Lectura ${mileage} km inferior al odómetro actual (${previous} km)`
          : null),
      created_by: input.userId,
    });

  if (historyError && !isMissingRelationOrColumn(historyError)) {
    throw mapPostgresError(historyError);
  }

  return { updated: shouldUpdateVehicle, previous };
}
