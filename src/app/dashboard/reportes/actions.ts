"use server";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { assertPermission } from "@/lib/auth/guards";
import {
  computeDepositMetrics,
  countsAsRealIncome,
  filterExpenseByDateRange,
  filterIncomeByDateRange,
  isOwnFleet,
  rankVehiclesByProfitability,
  sumRealIncome,
  summarizeOwnFleetMovement,
  type ExpenseRow,
  type IncomeRow,
  type ProfitabilityReservationRow,
  type VehicleProfitability,
} from "@/lib/calculations/profitability";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { asNumber } from "@/lib/safe-number";
import { createClient } from "@/lib/supabase/server";
import { formatVehicleLabel } from "@/lib/vehicles/label";
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
    ownFleetOnly: boolean;
    maintenanceCost: number;
  };
  profitability: VehicleProfitability[];
  /** Días rentados de todos los vehículos, incluidos los de proveedores. */
  movement: VehicleProfitability[];
  typeMovement: ReturnType<typeof summarizeOwnFleetMovement>;
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
    const ownFleetOnly = params.ownFleet !== "0";

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
      .is("deleted_at", null)
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

    const [incomeRes, expenseRes, reservationRes, maintenanceRes, vehiclesRes, settlementsRes] =
      await Promise.all([
        incomeQuery,
        expenseQuery,
        reservationQuery,
        maintenanceQuery,
        supabase
          .from("vehicles")
          .select(
            "id, brand, model, plate, category, ownership_type, sublease_daily_cost, sublease_payee_name",
          )
          .is("deleted_at", null)
          .eq("is_active", true),
        supabase
          .from("monthly_settlements")
          .select(
            "vehicle_id, vehicle_label, plate, rental_days, billed_amount, provider_cost, own_profit, period_month, vendor_name",
          )
          .is("deleted_at", null),
      ]);

    const firstError =
      incomeRes.error ??
      expenseRes.error ??
      reservationRes.error ??
      maintenanceRes.error ??
      vehiclesRes.error ??
      settlementsRes.error;
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
        category?: string | null;
        ownership_type?: string;
        sublease_daily_cost?: number | null;
        sublease_payee_name?: string | null;
      };
      return {
        id: v.id,
        label: formatVehicleLabel(v),
        category: v.category ?? null,
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

    // Mantenimiento cuenta como gasto operativo (antes no entraba en utilidad/ranking).
    const maintenanceExpenseRows: ExpenseRow[] = maintenance.map((row) => ({
      amount: Number(row.cost ?? 0),
      vehicle_id: row.vehicle_id,
      expense_date: row.maintenance_date,
    }));

    const reservationRows: ProfitabilityReservationRow[] = reservations
      .filter((row) => row.status !== "CANCELLED")
      .map((row) => ({
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
    const filteredExpensesOnly = filterExpenseByDateRange(
      expenseRows,
      filters.from,
      filters.to,
    );
    const filteredMaintenanceExpenses = filterExpenseByDateRange(
      maintenanceExpenseRows,
      filters.from,
      filters.to,
    );
    // Gastos del módulo + costo de mantenimiento → mismo “equivalente” de utilidad.
    const filteredExpenses = [
      ...filteredExpensesOnly,
      ...filteredMaintenanceExpenses,
    ];

    const totalRealIncome = sumRealIncome(filteredIncome);
    const totalExpenses = filteredExpenses.reduce(
      (sum, row) => sum + row.amount,
      0,
    );

    const completedReservations = reservations.filter(
      (row) => row.status === "COMPLETED",
    ).length;

    const totalFleet = (
      ownFleetOnly
        ? vehicles.filter((vehicle) => isOwnFleet(vehicle.ownership_type))
        : vehicles
    );
    const fleetIds = new Set(totalFleet.map((vehicle) => vehicle.id));
    const occupiedNow = reservations.filter(
      (row) => row.status === "ACTIVE" && fleetIds.has(row.vehicle_id),
    ).length;
    const occupancyRate = Math.round(
      (occupiedNow / (totalFleet.length || 1)) * 100,
    );

    const maintenanceCost = filteredMaintenanceExpenses.reduce(
      (sum, row) => sum + row.amount,
      0,
    );

    const profitability = rankVehiclesByProfitability(
      filters.vehicleId
        ? vehicles.filter((v) => v.id === filters.vehicleId)
        : vehicles,
      filteredIncome,
      filteredExpenses,
      reservationRows,
      filters.from,
      filters.to,
    ).map((row) => ({
      ...row,
      ownershipType:
        vehicles.find((vehicle) => vehicle.id === row.vehicleId)
          ?.ownership_type ?? "OWN",
    }));

    const settlements = (
      (settlementsRes.data ?? []) as Array<{
        vehicle_id: string | null;
        vehicle_label: string | null;
        plate: string | null;
        rental_days: number | null;
        billed_amount: number;
        provider_cost: number;
        own_profit: number;
        period_month: string;
        vendor_name: string | null;
      }>
    ).filter((row) => {
      const period = String(row.period_month).slice(0, 10);
      if (filters.from && period < filters.from) return false;
      if (filters.to && period > filters.to) return false;
      if (filters.vehicleId && row.vehicle_id !== filters.vehicleId) return false;
      return asNumber(row.provider_cost, 0) > 0 || asNumber(row.billed_amount, 0) > 0;
    });

    const providerVehicleIds = new Set(
      settlements
        .filter((row) => asNumber(row.provider_cost, 0) > 0 && row.vehicle_id)
        .map((row) => row.vehicle_id as string),
    );
    const ownProfitability = profitability.filter(
      (row) =>
        isOwnFleet(row.ownershipType) && !providerVehicleIds.has(row.vehicleId),
    );

    const subleaseByVehicle = new Map<
      string,
      {
        vehicleId: string;
        vehicleLabel: string;
        payeeName: string;
        dailyCost: number;
        rentalDays: number;
        subleaseTotal: number;
        realIncome: number;
        netRealUtility: number;
      }
    >();

    for (const row of settlements) {
      const vehicle = vehicles.find((item) => item.id === row.vehicle_id);
      const subleased = vehicle
        ? !isOwnFleet(vehicle.ownership_type)
        : asNumber(row.provider_cost, 0) > 0;
      if (!subleased) continue;

      const key = row.vehicle_id ?? row.vehicle_label ?? row.plate ?? "sin-vehiculo";
      const current = subleaseByVehicle.get(key) ?? {
        vehicleId: key,
        vehicleLabel:
          vehicle?.label ??
          ([row.vehicle_label, row.plate].filter(Boolean).join(" · ") ||
            "Vehículo de proveedor"),
        payeeName:
          row.vendor_name?.trim() ||
          vehicle?.sublease_payee_name?.trim() ||
          "—",
        dailyCost: asNumber(vehicle?.sublease_daily_cost, 0),
        rentalDays: 0,
        subleaseTotal: 0,
        realIncome: 0,
        netRealUtility: 0,
      };
      current.rentalDays += asNumber(row.rental_days, 0);
      current.subleaseTotal += asNumber(row.provider_cost, 0);
      current.realIncome += asNumber(row.billed_amount, 0);
      current.netRealUtility += asNumber(row.own_profit, 0);
      if (current.rentalDays > 0) {
        current.dailyCost = current.subleaseTotal / current.rentalDays;
      }
      subleaseByVehicle.set(key, current);
    }

    const subleaseReport = [...subleaseByVehicle.values()];
    const totalSubleaseCost = subleaseReport.reduce(
      (sum, row) => sum + row.subleaseTotal,
      0,
    );
    const typeMovement = summarizeOwnFleetMovement(
      vehicles.map((vehicle) => ({
        id: vehicle.id,
        category: vehicle.category,
        ownershipType: vehicle.ownership_type,
      })),
      reservationRows,
      filters.from,
      filters.to,
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
        ownFleetOnly,
        maintenanceCost,
      },
      profitability: ownProfitability,
      movement: [...profitability].sort((a, b) => b.rentalDays - a.rentalDays),
      typeMovement,
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
    let maintenanceQuery = supabase
      .from("maintenance_records")
      .select("cost, vehicle_id, maintenance_date")
      .is("deleted_at", null);

    if (from) {
      incomeQuery = incomeQuery.gte("transaction_date", from);
      expenseQuery = expenseQuery.gte("expense_date", from);
      maintenanceQuery = maintenanceQuery.gte("maintenance_date", from);
    }
    if (to) {
      incomeQuery = incomeQuery.lte("transaction_date", to);
      expenseQuery = expenseQuery.lte("expense_date", to);
      maintenanceQuery = maintenanceQuery.lte("maintenance_date", to);
    }

    const [incomeRes, expenseRes, maintenanceRes, vehiclesRes, reservationsRes, settlementsRes] =
      await Promise.all([
        incomeQuery,
        expenseQuery,
        maintenanceQuery,
        supabase
          .from("vehicles")
          .select("id, brand, model, plate, ownership_type")
          .is("deleted_at", null)
          .eq("is_active", true),
        supabase
          .from("reservations")
          .select("vehicle_id, start_at, end_at, status")
          .is("deleted_at", null)
          .in("status", ["ACTIVE", "COMPLETED"]),
        supabase
          .from("monthly_settlements")
          .select("provider_cost, period_month, vehicle_id")
          .is("deleted_at", null),
      ]);

    const firstError =
      incomeRes.error ??
      expenseRes.error ??
      maintenanceRes.error ??
      vehiclesRes.error ??
      reservationsRes.error ??
      settlementsRes.error;
    if (firstError) throw mapPostgresError(firstError);

    const incomeRows = (incomeRes.data ?? []) as IncomeRow[];
    const expenseRows = (expenseRes.data ?? []) as ExpenseRow[];
    const maintenanceExpenseRows: ExpenseRow[] = (
      (maintenanceRes.data ?? []) as Array<{
        cost: number;
        vehicle_id: string | null;
        maintenance_date: string;
      }>
    ).map((row) => ({
      amount: Number(row.cost ?? 0),
      vehicle_id: row.vehicle_id,
      expense_date: row.maintenance_date,
    }));
    const allExpenseRows = [...expenseRows, ...maintenanceExpenseRows];
    const reservationRows = (reservationsRes.data ?? []) as ProfitabilityReservationRow[];

    const vehicles = (vehiclesRes.data ?? []).map((row) => {
      const v = row as {
        id: string;
        brand: string;
        model: string;
        plate: string;
        ownership_type?: string | null;
      };
      return {
        id: v.id,
        label: formatVehicleLabel(v),
        ownershipType: v.ownership_type,
      };
    });

    const ranking = rankVehiclesByProfitability(
      vehicles,
      incomeRows,
      allExpenseRows,
      reservationRows,
      from,
      to,
    );

    const providerRows = (
      (settlementsRes.data ?? []) as Array<{
        provider_cost: number;
        period_month: string;
        vehicle_id: string | null;
      }>
    ).filter((row) => {
      const period = String(row.period_month).slice(0, 10);
      if (from && period < from) return false;
      if (to && period > to) return false;
      return asNumber(row.provider_cost, 0) > 0;
    });
    const providerVehicleIds = new Set(
      providerRows
        .map((row) => row.vehicle_id)
        .filter((id): id is string => Boolean(id)),
    );
    const providerCost = providerRows.reduce(
      (sum, row) => sum + asNumber(row.provider_cost, 0),
      0,
    );
    const ownRanking = ranking.filter((row) => {
      const vehicle = vehicles.find((item) => item.id === row.vehicleId);
      return (
        isOwnFleet(vehicle?.ownershipType) &&
        !providerVehicleIds.has(row.vehicleId)
      );
    });

    const monthIncome = sumRealIncome(incomeRows);
    const monthExpenses =
      allExpenseRows.reduce((sum, row) => sum + row.amount, 0) + providerCost;

    const chartMap = new Map<string, { income: number; expense: number }>();
    for (const row of incomeRows) {
      const key = row.transaction_date;
      const entry = chartMap.get(key) ?? { income: 0, expense: 0 };
      entry.income += countsAsRealIncome(row);
      chartMap.set(key, entry);
    }
    for (const row of allExpenseRows) {
      const key = row.expense_date;
      const entry = chartMap.get(key) ?? { income: 0, expense: 0 };
      entry.expense += row.amount;
      chartMap.set(key, entry);
    }
    for (const row of providerRows) {
      const key = String(row.period_month).slice(0, 10);
      const entry = chartMap.get(key) ?? { income: 0, expense: 0 };
      entry.expense += asNumber(row.provider_cost, 0);
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
      topVehicle: ownRanking[0] ?? null,
      chartData,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
