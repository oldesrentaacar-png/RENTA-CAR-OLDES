import { writeAuditLog } from "@/lib/audit";
import { displayBalanceDue } from "@/lib/contracts/amount-owed";
import {
  isReservationOverlapError,
  syncReservationFromContract,
} from "@/lib/contracts/sync-reservation";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { mapPostgresError } from "@/lib/errors";
import { toNumber } from "@/lib/money";
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
      "id, status, closed_at, reservation_id, vehicle_id, start_at, end_at, agreed_rate, deposit, insurance, total, amount_paid, courtesy_amount, courtesy_detail, notes, balance_due, payment_status",
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
    amount_paid: number | null;
    courtesy_amount: number | null;
    courtesy_detail: string | null;
    notes: string | null;
    balance_due: number | null;
    payment_status: string | null;
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
  const amountPaid = toNumber(row.amount_paid ?? 0);
  const balanceDue = displayBalanceDue({
    total: Number(row.total ?? 0),
    amountPaid,
    balanceDue: row.balance_due,
    paymentStatus: row.payment_status,
    courtesyAmount: row.courtesy_amount,
  });
  const paymentStatus =
    balanceDue > 0.009 ? (amountPaid > 0.009 ? "PARTIAL" : "PENDING") : "PAID";

  let { data: closedRow, error: updateError } = await writer
    .from("contracts")
    .update({
      status: "COMPLETED",
      closed_at: closedAt,
      actual_return_at: actualReturnAt,
      balance_due: balanceDue,
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

  try {
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
  } catch (error) {
    if (isReservationOverlapError(error)) {
      await writer
        .from("reservations")
        .update({
          status: "COMPLETED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.reservation_id)
        .is("deleted_at", null);
    } else {
      throw error;
    }
  }

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
