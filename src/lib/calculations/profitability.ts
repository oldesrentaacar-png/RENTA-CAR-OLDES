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
};

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

function overlapDays(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): number {
  const start = Math.max(startA.getTime(), startB.getTime());
  const end = Math.min(endA.getTime(), endB.getTime());
  if (end <= start) return 0;
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

export function countRentalDays(
  reservations: ProfitabilityReservationRow[],
  vehicleId: string,
  from?: string,
  to?: string,
): number {
  const rangeStart = from ? new Date(`${from}T00:00:00`) : null;
  const rangeEnd = to ? new Date(`${to}T23:59:59`) : null;

  return reservations
    .filter(
      (row) =>
        row.vehicle_id === vehicleId &&
        (row.status === "ACTIVE" || row.status === "COMPLETED"),
    )
    .reduce((total, row) => {
      const start = new Date(row.start_at);
      const end = new Date(row.end_at);
      if (rangeStart && rangeEnd) {
        return total + overlapDays(start, end, rangeStart, rangeEnd);
      }
      return (
        total +
        Math.max(
          1,
          Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
        )
      );
    }, 0);
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
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
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
