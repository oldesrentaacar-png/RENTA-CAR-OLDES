import { fromZonedTime } from "date-fns-tz";

import { APP_TIMEZONE, appYearMonth } from "@/lib/dates";
import type { DepositStatus, IncomeType } from "@/types/database";

export type IncomeRow = {
  type: IncomeType;
  amount: number;
  deposit_status: DepositStatus | null;
  vehicle_id: string | null;
  transaction_date: string;
};

export type ExpenseRow = {
  amount: number;
  vehicle_id: string | null;
  expense_date: string;
};

export type ProfitabilityReservationRow = {
  vehicle_id: string;
  start_at: string;
  end_at: string;
  status: string;
};

export type VehicleProfitability = {
  vehicleId: string;
  vehicleLabel: string;
  realIncome: number;
  expenses: number;
  utility: number;
  rentalDays: number;
  /** OWN es flota propia. El resto (subarrendo, tercero, consignación) no compite como “mi carro más rentable”. */
  ownershipType?: string;
};

export function isOwnFleet(ownershipType: string | null | undefined): boolean {
  return (ownershipType ?? "OWN").toUpperCase() === "OWN";
}

export function inclusiveDayCount(from?: string, to?: string): number {
  if (!from || !to) return 1;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

export type FleetTypeMovement = {
  category: string;
  vehicles: number;
  rentalDays: number;
  occupancyPercent: number;
};

/** Días rentados de la flota propia, agrupados por categoría, para el periodo del reporte. */
export function summarizeOwnFleetMovement(
  vehicles: Array<{
    id: string;
    category: string | null;
    ownershipType?: string | null;
  }>,
  reservations: ProfitabilityReservationRow[],
  from?: string,
  to?: string,
): FleetTypeMovement[] {
  const periodDays = inclusiveDayCount(from, to);
  const groups = new Map<string, { vehicles: number; rentalDays: number }>();

  for (const vehicle of vehicles) {
    if (!isOwnFleet(vehicle.ownershipType)) continue;
    const category = vehicle.category?.trim() || "Sin categoría";
    const entry = groups.get(category) ?? { vehicles: 0, rentalDays: 0 };
    entry.vehicles += 1;
    entry.rentalDays += countRentalDays(reservations, vehicle.id, from, to);
    groups.set(category, entry);
  }

  return [...groups.entries()]
    .map(([category, entry]) => ({
      category,
      vehicles: entry.vehicles,
      rentalDays: entry.rentalDays,
      occupancyPercent:
        entry.vehicles === 0
          ? 0
          : Math.round(
              (entry.rentalDays / (entry.vehicles * periodDays)) * 100,
            ),
    }))
    .sort((a, b) => b.rentalDays - a.rentalDays);
}

export type DepositMetrics = {
  received: number;
  returned: number;
  retained: number;
  applied: number;
};

const RETAINED_DEPOSIT_STATUSES: DepositStatus[] = [
  "HELD",
  "APPLIED",
  "PARTIALLY_APPLIED",
];

/** Depósitos reembolsables no cuentan como utilidad hasta retenerse o aplicarse. */
export function countsAsRealIncome(row: Pick<IncomeRow, "type" | "amount" | "deposit_status">): number {
  if (row.type !== "DEPOSIT") {
    return row.amount;
  }

  if (
    row.deposit_status &&
    RETAINED_DEPOSIT_STATUSES.includes(row.deposit_status)
  ) {
    return row.amount;
  }

  return 0;
}

export function sumRealIncome(rows: IncomeRow[]): number {
  return rows.reduce((sum, row) => sum + countsAsRealIncome(row), 0);
}

export function computeDepositMetrics(rows: IncomeRow[]): DepositMetrics {
  const deposits = rows.filter((row) => row.type === "DEPOSIT");
  return {
    received: deposits
      .filter((row) => row.deposit_status === "RECEIVED")
      .reduce((sum, row) => sum + row.amount, 0),
    returned: deposits
      .filter((row) => row.deposit_status === "RETURNED")
      .reduce((sum, row) => sum + row.amount, 0),
    retained: deposits
      .filter((row) => row.deposit_status === "HELD")
      .reduce((sum, row) => sum + row.amount, 0),
    applied: deposits
      .filter(
        (row) =>
          row.deposit_status === "APPLIED" ||
          row.deposit_status === "PARTIALLY_APPLIED",
      )
      .reduce((sum, row) => sum + row.amount, 0),
  };
}

function nextCalendarDate(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function appDayStartMs(ymd: string): number {
  return fromZonedTime(`${ymd}T00:00:00`, APP_TIMEZONE).getTime();
}

/** Días ocupados de un vehículo. Intervalos que se pisan se cuentan una sola vez. */
export function countRentalDays(
  reservations: ProfitabilityReservationRow[],
  vehicleId: string,
  from?: string,
  to?: string,
): number {
  const rangeStart = from ? appDayStartMs(from) : null;
  const rangeEnd = to ? appDayStartMs(nextCalendarDate(to)) : null;
  const intervals: Array<[number, number]> = [];

  for (const row of reservations) {
    if (row.vehicle_id !== vehicleId) continue;
    if (row.status !== "ACTIVE" && row.status !== "COMPLETED") continue;
    let start = new Date(row.start_at).getTime();
    let end = new Date(row.end_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    if (rangeStart != null && rangeEnd != null) {
      start = Math.max(start, rangeStart);
      end = Math.min(end, rangeEnd);
      if (end <= start) continue;
    }
    intervals.push([start, end]);
  }

  intervals.sort((a, b) => a[0] - b[0]);
  let totalMs = 0;
  let blockStart = -1;
  let blockEnd = -1;
  for (const [start, end] of intervals) {
    if (blockStart < 0) {
      blockStart = start;
      blockEnd = end;
      continue;
    }
    if (start <= blockEnd) {
      blockEnd = Math.max(blockEnd, end);
      continue;
    }
    totalMs += blockEnd - blockStart;
    blockStart = start;
    blockEnd = end;
  }
  if (blockStart >= 0) totalMs += blockEnd - blockStart;
  if (totalMs <= 0) return 0;
  return Math.ceil(totalMs / 86_400_000);
}

export function fleetOccupancyPercent(
  vehicleIds: string[],
  reservations: ProfitabilityReservationRow[],
  from?: string,
  to?: string,
): number {
  if (vehicleIds.length === 0) return 0;
  const rented = vehicleIds.reduce(
    (sum, vehicleId) => sum + countRentalDays(reservations, vehicleId, from, to),
    0,
  );
  const periodDays = inclusiveDayCount(from, to);
  return Math.round((rented / (vehicleIds.length * periodDays)) * 100);
}

export function computeVehicleProfitability(
  vehicleId: string,
  vehicleLabel: string,
  incomeRows: IncomeRow[],
  expenseRows: ExpenseRow[],
  reservations: ProfitabilityReservationRow[],
  from?: string,
  to?: string,
): VehicleProfitability {
  const vehicleIncome = incomeRows.filter((row) => row.vehicle_id === vehicleId);
  const vehicleExpenses = expenseRows.filter(
    (row) => row.vehicle_id === vehicleId,
  );

  const realIncome = sumRealIncome(vehicleIncome);
  const expenses = vehicleExpenses.reduce((sum, row) => sum + row.amount, 0);

  return {
    vehicleId,
    vehicleLabel,
    realIncome,
    expenses,
    utility: realIncome - expenses,
    rentalDays: countRentalDays(reservations, vehicleId, from, to),
  };
}

export function rankVehiclesByProfitability(
  vehicles: Array<{ id: string; label: string }>,
  incomeRows: IncomeRow[],
  expenseRows: ExpenseRow[],
  reservations: ProfitabilityReservationRow[],
  from?: string,
  to?: string,
): VehicleProfitability[] {
  return vehicles
    .map((vehicle) =>
      computeVehicleProfitability(
        vehicle.id,
        vehicle.label,
        incomeRows,
        expenseRows,
        reservations,
        from,
        to,
      ),
    )
    .sort((a, b) => b.utility - a.utility);
}

export function getMonthBounds(date = new Date()): { from: string; to: string } {
  const month = appYearMonth(date);
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function filterIncomeByDateRange(
  rows: IncomeRow[],
  from?: string,
  to?: string,
): IncomeRow[] {
  if (!from && !to) return rows;
  return rows.filter((row) => {
    if (from && row.transaction_date < from) return false;
    if (to && row.transaction_date > to) return false;
    return true;
  });
}

export function filterExpenseByDateRange(
  rows: ExpenseRow[],
  from?: string,
  to?: string,
): ExpenseRow[] {
  if (!from && !to) return rows;
  return rows.filter((row) => {
    if (from && row.expense_date < from) return false;
    if (to && row.expense_date > to) return false;
    return true;
  });
}
