import { writeAuditLog } from "@/lib/audit";
import { syncReservationFromContract } from "@/lib/contracts/sync-reservation";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { mapPostgresError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistVehicleAvailableAfterContractClose } from "@/lib/vehicles/operational-write";

const CLOSE_NOTE =
  "[Cierre] Completado a partir de la inspección de ingreso. Totales del contrato no se modificaron.";

/**
 * Operational close after a real CHECK_IN (km + fuel already on the inspection).
 * Does not invent extra-day charges. Never treats a 0-row update as success.
 */
export async function completeOpenContractAfterCheckIn(input: {
  contractId: string;
  userId: string;
  actualReturnAt?: string | null;
  checkInId?: string | null;
}): Promise<{ completed: boolean }> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      "No se pudo cerrar el contrato después de la inspección: falta configuración de administración.",
    );
  }

  const writer = createAdminClient();
  const { data: existing, error: readError } = await writer
    .from("contracts")
    .select(
      "id, status, closed_at, reservation_id, vehicle_id, start_at, end_at, agreed_rate, deposit, insurance, total, courtesy_amount, courtesy_detail, notes, balance_due",
    )
    .eq("id", input.contractId)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) throw mapPostgresError(readError);
  if (!existing) return { completed: false };

  const row = existing as {
    id: string;
    status: string;
    closed_at: string | null;
    reservation_id: string;
    vehicle_id: string;
    start_at: string;
    end_at: string;
    agreed_rate: number;
    deposit: number | null;
    insurance: number | null;
    total: number;
    courtesy_amount: number | null;
    courtesy_detail: string | null;
    notes: string | null;
    balance_due: number | null;
  };

  if (row.status === "CANCELLED" || row.status === "COMPLETED" || row.closed_at) {
    return { completed: false };
  }

  const closedAt = new Date().toISOString();
  const actualReturnAt = input.actualReturnAt || row.end_at;
  const mergedNotes =
    row.notes && row.notes.includes("[Cierre]")
      ? row.notes
      : row.notes
        ? `${row.notes}\n\n${CLOSE_NOTE}`
        : CLOSE_NOTE;
  const balanceDue = Number(row.balance_due ?? 0);
  const paymentStatus =
    balanceDue > 0.009 ? "PARTIAL" : "PAID";

  let { data: closedRow, error: updateError } = await writer
    .from("contracts")
    .update({
      status: "COMPLETED",
      closed_at: closedAt,
      actual_return_at: actualReturnAt,
      payment_status: paymentStatus,
      notes: mergedNotes,
    })
    .eq("id", row.id)
    .is("deleted_at", null)
    .is("closed_at", null)
    .select("id, status, closed_at")
    .maybeSingle();

  if (updateError) {
    const msg = `${updateError.message ?? ""}`.toLowerCase();
    if (msg.includes("does not exist") || msg.includes("42703")) {
      const retry = await writer
        .from("contracts")
        .update({
          status: "COMPLETED",
          closed_at: closedAt,
          notes: mergedNotes,
        })
        .eq("id", row.id)
        .is("deleted_at", null)
        .is("closed_at", null)
        .select("id, status, closed_at")
        .maybeSingle();
      updateError = retry.error;
      closedRow = retry.data;
    }
  }

  if (updateError) throw mapPostgresError(updateError);
  if (!closedRow) {
    throw new Error(
      "No se pudo cerrar el contrato después de la inspección de ingreso.",
    );
  }

  await persistVehicleAvailableAfterContractClose(row.vehicle_id, row.id);

  await syncReservationFromContract(writer, {
    reservationId: row.reservation_id,
    startAt: row.start_at,
    endAt: actualReturnAt,
    agreedRate: row.agreed_rate,
    deposit: row.deposit,
    insurance: row.insurance,
    total: Number(row.total),
    courtesyAmount: row.courtesy_amount,
    courtesyDetail: row.courtesy_detail,
    vehicleId: row.vehicle_id,
    status: "COMPLETED",
  });

  await writeAuditLog({
    userId: input.userId,
    action: "contract.close_from_checkin",
    entityType: "contract",
    entityId: row.id,
    metadata: {
      checkInId: input.checkInId ?? null,
      actualReturnAt,
    },
  });

  return { completed: true };
}
