import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * After a contract exists, it is the operational source of truth.
 * Keep the linked reservation aligned so the calendar (reservation-backed)
 * stays correct without editing two records.
 */
export async function syncReservationFromContract(
  supabase: SupabaseClient,
  input: {
    reservationId: string;
    startAt?: string | null;
    endAt?: string | null;
    agreedRate?: number | null;
    deposit?: number | null;
    insurance?: number | null;
    total?: number | null;
    courtesyAmount?: number | null;
    courtesyDetail?: string | null;
    vehicleId?: string | null;
    status?: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.startAt) patch.start_at = input.startAt;
  if (input.endAt) patch.end_at = input.endAt;
  if (input.agreedRate != null && Number.isFinite(input.agreedRate)) {
    patch.agreed_rate = input.agreedRate;
  }
  if (input.deposit != null && Number.isFinite(input.deposit)) {
    patch.deposit = input.deposit;
  }
  if (input.insurance != null && Number.isFinite(input.insurance)) {
    patch.insurance = input.insurance;
  }
  if (input.total != null && Number.isFinite(input.total)) {
    patch.total = input.total;
  }
  if (input.courtesyAmount != null && Number.isFinite(input.courtesyAmount)) {
    patch.courtesy_amount = input.courtesyAmount;
  }
  if (input.courtesyDetail !== undefined) {
    patch.courtesy_detail = input.courtesyDetail;
  }
  if (input.vehicleId) patch.vehicle_id = input.vehicleId;
  if (input.status) patch.status = input.status;

  const { error } = await supabase
    .from("reservations")
    .update(patch)
    .eq("id", input.reservationId)
    .is("deleted_at", null);

  if (error) {
    console.error(
      "[syncReservationFromContract]",
      input.reservationId,
      error.message,
    );
  }
}

export type LinkedContractSummary = {
  id: string;
  code: string;
  status: string;
  closed_at: string | null;
};

/** Non-cancelled contract linked to a reservation (operational owner). */
export async function getLinkedOpenContract(
  supabase: SupabaseClient,
  reservationId: string,
): Promise<LinkedContractSummary | null> {
  const { data } = await supabase
    .from("contracts")
    .select("id, code, status, closed_at")
    .eq("reservation_id", reservationId)
    .neq("status", "CANCELLED")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return data as LinkedContractSummary;
}
