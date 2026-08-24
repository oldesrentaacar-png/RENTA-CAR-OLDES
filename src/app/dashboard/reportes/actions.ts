"use server";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { assertPermission } from "@/lib/auth/guards";
import {
  computeDepositMetrics,
  countsAsRealIncome,
  filterExpenseByDateRange,
  filterIncomeByDateRange,
  rankVehiclesByProfitability,
  sumRealIncome,
  type ExpenseRow,
  type IncomeRow,
  type ProfitabilityReservationRow,
  type VehicleProfitability,
} from "@/lib/calculations/profitability";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { reportFiltersSchema } from "@/lib/validation/finance";
import type {
  ExpenseTransaction,
  IncomeTransaction,
  MaintenanceRecord,
  Reservation,
} from "@/types/database";

export type ReportData = {
  incomes: IncomeTransaction[];
  expenses: ExpenseTransaction[];
  reservations: Reservation[];
  maintenance: MaintenanceRecord[];
  summary: {
    totalRealIncome: number;
    totalExpenses: number;
    netUtility: number;
    /** Costo acumulado a proveedores de vehículos subarrendados. */
    subleaseProviderCost: number;
    depositMetrics: ReturnType<typeof computeDepositMetrics>;
    reservationCount: number;
    completedReservations: number;
    occupancyRate: number;
    maintenanceCost: number;
  };
  profitability: ReturnType<typeof rankVehiclesByProfitability>;
  subleaseReport: Array<{
    vehicleId: string;
    vehicleLabel: string;
    payeeName: string;
    dailyCost: number;
    rentalDays: number;
    subleaseTotal: number;
    realIncome: number;
    netRealUtility: number;
  }>;
  vehicles: Array<{ id: string; label: string }>;
};

export async function fetchReportData(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<ReportData>> {
  try {
    await assertPermission("reports.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = reportFiltersSchema.parse({
      from: params.from,
      to: params.to,
      vehicleId: params.vehicleId,
      category: params.category,
    });

    const supabase = await createClient();

    let incomeQuery = supabase
      .from("income_transactions")
      .select("*")
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false });

    let expenseQuery = supabase
      .from("expense_transactions")
      .select("*")
      .is("deleted_at", null)
      .order("expense_date", { ascending: false });

    let reservationQuery = supabase
      .from("reservations")
      .select("*")
      .is("deleted_at", null)
      .order("start_at", { ascending: false });

    let maintenanceQuery = supabase
      .from("maintenance_records")
      .select("*")
      .order("maintenance_date", { ascending: false });

    if (filters.from) {
      incomeQuery = incomeQuery.gte("transaction_date", filters.from);
      expenseQuery = expenseQuery.gte("expense_date", filters.from);
      reservationQuery = reservationQuery.gte("start_at", `${filters.from}T00:00:00`);
      maintenanceQuery = maintenanceQuery.gte("maintenance_date", filters.from);
    }
    if (filters.to) {
      incomeQuery = incomeQuery.lte("transaction_date", filters.to);
      expenseQuery = expenseQuery.lte("expense_date", filters.to);
      reservationQuery = reservationQuery.lte("end_at", `${filters.to}T23:59:59`);
      maintenanceQuery = maintenanceQuery.lte("maintenance_date", filters.to);
    }
    if (filters.vehicleId) {
      incomeQuery = incomeQuery.eq("vehicle_id", filters.vehicleId);
      expenseQuery = expenseQuery.eq("vehicle_id", filters.vehicleId);
      reservationQuery = reservationQuery.eq("vehicle_id", filters.vehicleId);
      maintenanceQuery = maintenanceQuery.eq("vehicle_id", filters.vehicleId);
    }
    if (filters.category) {
      expenseQuery = expenseQuery.eq("category", filters.category);
    }

    const [incomeRes, expenseRes, reservationRes, maintenanceRes, vehiclesRes] =
      await Promise.all([
        incomeQuery,
        expenseQuery,
        reservationQuery,
        maintenanceQuery,
        supabase
          .from("vehicles")
          .select(
            "id, brand, model, plate, ownership_type, sublease_daily_cost, sublease_payee_name",
          )
          .is("deleted_at", null)
          .eq("is_active", true),
      ]);

    const firstError =
      incomeRes.error ??
      expenseRes.error ??
      reservationRes.error ??
      maintenanceRes.error ??
      vehiclesRes.error;
    if (firstError) throw mapPostgresError(firstError);

    const incomes = (incomeRes.data ?? []) as IncomeTransaction[];
    const expenses = (expenseRes.data ?? []) as ExpenseTransaction[];
    const reservations = (reservationRes.data ?? []) as Reservation[];
    const maintenance = (maintenanceRes.data ?? []) as MaintenanceRecord[];

    const vehicles = (vehiclesRes.data ?? []).map((row) => {
      const v = row as {
        id: string;
        brand: string;
        model: string;
        plate: string;
        ownership_type?: string;
        sublease_daily_cost?: number | null;
        sublease_payee_name?: string | null;
      };
      return {
        id: v.id,
        label: `${v.brand} ${v.model} (${v.plate})`,
        ownership_type: v.ownership_type,
        sublease_daily_cost: v.sublease_daily_cost,
        sublease_payee_name: v.sublease_payee_name,
      };
    });

    const incomeRows: IncomeRow[] = incomes.map((row) => ({
      type: row.type,
      amount: row.amount,
      deposit_status: row.deposit_status,
      vehicle_id: row.vehicle_id,
      transaction_date: row.transaction_date,
    }));

    const expenseRows: ExpenseRow[] = expenses.map((row) => ({
      amount: row.amount,
      vehicle_id: row.vehicle_id,
      expense_date: row.expense_date,
    }));

    const reservationRows: ProfitabilityReservationRow[] = reservations.map((row) => ({
      vehicle_id: row.vehicle_id,
      start_at: row.start_at,
      end_at: row.end_at,
      status: row.status,
    }));

    const filteredIncome = filterIncomeByDateRange(
      incomeRows,
      filters.from,
      filters.to,
    );
    const filteredExpenses = filterExpenseByDateRange(
      expenseRows,
      filters.from,
      filters.to,
    );

    const totalRealIncome = sumRealIncome(filteredIncome);
    const totalExpenses = filteredExpenses.reduce(
      (sum, row) => sum + row.amount,
      0,
    );

    const completedReservations = reservations.filter(
      (row) => row.status === "COMPLETED",
    ).length;

    const totalFleet = vehicles.length || 1;
    const occupiedNow = reservations.filter((row) => row.status === "ACTIVE").length;
    const occupancyRate = Math.round((occupiedNow / totalFleet) * 100);

    const maintenanceCost = maintenance.reduce((sum, row) => sum + row.cost, 0);

    const profitability = rankVehiclesByProfitability(
      filters.vehicleId
        ? vehicles.filter((v) => v.id === filters.vehicleId)
        : vehicles,
      filteredIncome,
      filteredExpenses,
      reservationRows,
      filters.from,
      filters.to,
    );

    const subleaseReport = vehicles
      .filter(
        (vehicle) =>
          vehicle.ownership_type === "SUBLEASED" &&
          vehicle.sublease_daily_cost != null &&
          vehicle.sublease_daily_cost > 0,
      )
      .map((vehicle) => {
        const prof = profitability.find((row) => row.vehicleId === vehicle.id);
        const rentalDays = prof?.rentalDays ?? 0;
        const subleaseTotal = rentalDays * Number(vehicle.sublease_daily_cost);
        const realIncome = prof?.realIncome ?? 0;
        return {
          vehicleId: vehicle.id,
          vehicleLabel: vehicle.label,
          payeeName: vehicle.sublease_payee_name ?? "—",
          dailyCost: Number(vehicle.sublease_daily_cost),
          rentalDays,
          subleaseTotal,
          realIncome,
          netRealUtility: realIncome - subleaseTotal - (prof?.expenses ?? 0),
        };
      });

    const totalSubleaseCost = subleaseReport.reduce(
      (sum, row) => sum + row.subleaseTotal,
      0,
    );

    return actionSuccess({
      incomes,
      expenses,
      reservations,
      maintenance,
      vehicles: vehicles.map(({ id, label }) => ({ id, label })),
      summary: {
        totalRealIncome,
        totalExpenses,
        /** Utilidad neta descontando costo a proveedores de subarrendo (evita ganancias ficticias). */
        netUtility: totalRealIncome - totalExpenses - totalSubleaseCost,
        subleaseProviderCost: totalSubleaseCost,
        depositMetrics: computeDepositMetrics(filteredIncome),
        reservationCount: reservations.length,
        completedReservations,
        occupancyRate,
        maintenanceCost,
      },
      profitability,
      subleaseReport,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function fetchFinanceSummary(
  from?: string,
  to?: string,
): Promise<
  ActionResult<{
    monthIncome: number;
    monthExpenses: number;
    net: number;
    depositMetrics: ReturnType<typeof computeDepositMetrics>;
    topVehicle: VehicleProfitability | null;
    chartData: Array<{ date: string; income: number; expense: number }>;
  }>
> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();

    let incomeQuery = supabase
      .from("income_transactions")
      .select("type, amount, deposit_status, vehicle_id, transaction_date")
      .is("deleted_at", null);
    let expenseQuery = supabase
      .from("expense_transactions")
      .select("amount, vehicle_id, expense_date")
      .is("deleted_at", null);

    if (from) {
      incomeQuery = incomeQuery.gte("transaction_date", from);
      expenseQuery = expenseQuery.gte("expense_date", from);
    }
    if (to) {
      incomeQuery = incomeQuery.lte("transaction_date", to);
      expenseQuery = expenseQuery.lte("expense_date", to);
    }

    const [incomeRes, expenseRes, vehiclesRes, reservationsRes] =
      await Promise.all([
        incomeQuery,
        expenseQuery,
        supabase
          .from("vehicles")
          .select("id, brand, model, plate")
          .is("deleted_at", null)
          .eq("is_active", true),
        supabase
          .from("reservations")
          .select("vehicle_id, start_at, end_at, status")
          .is("deleted_at", null)
          .in("status", ["ACTIVE", "COMPLETED"]),
      ]);

    const firstError =
      incomeRes.error ?? expenseRes.error ?? vehiclesRes.error ?? reservationsRes.error;
    if (firstError) throw mapPostgresError(firstError);

    const incomeRows = (incomeRes.data ?? []) as IncomeRow[];
    const expenseRows = (expenseRes.data ?? []) as ExpenseRow[];
    const reservationRows = (reservationsRes.data ?? []) as ProfitabilityReservationRow[];

    const monthIncome = sumRealIncome(incomeRows);
    const monthExpenses = expenseRows.reduce((sum, row) => sum + row.amount, 0);

    const vehicles = (vehiclesRes.data ?? []).map((row) => {
      const v = row as { id: string; brand: string; model: string; plate: string };
      return {
        id: v.id,
        label: `${v.brand} ${v.model} (${v.plate})`,
      };
    });

    const ranking = rankVehiclesByProfitability(
      vehicles,
      incomeRows,
      expenseRows,
      reservationRows,
      from,
      to,
    );

    const chartMap = new Map<string, { income: number; expense: number }>();
    for (const row of incomeRows) {
      const key = row.transaction_date;
      const entry = chartMap.get(key) ?? { income: 0, expense: 0 };
      entry.income += countsAsRealIncome(row);
      chartMap.set(key, entry);
    }
    for (const row of expenseRows) {
      const key = row.expense_date;
      const entry = chartMap.get(key) ?? { income: 0, expense: 0 };
      entry.expense += row.amount;
      chartMap.set(key, entry);
    }

    const chartData = [...chartMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));

    return actionSuccess({
      monthIncome,
      monthExpenses,
      net: monthIncome - monthExpenses,
      depositMetrics: computeDepositMetrics(incomeRows),
      topVehicle: ranking[0] ?? null,
      chartData,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
