"use server";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { asNumber } from "@/lib/safe-number";
import { createClient } from "@/lib/supabase/server";
import { monthFilterSchema } from "@/lib/validation/settlement";
import type { ExpenseTransaction, MonthlySettlement } from "@/types/database";

export type BalanceSummary = {
  month: string;
  billedAmount: number;
  settlementProfit: number;
  /** Costo al proveedor en la liquidación del mes, pagado o pendiente. */
  providerCost: number;
  otherSettlementCosts: number;
  operatingExpenses: number;
  realNetProfit: number;
};

export type BalanceDashboardData = BalanceSummary & {
  composition: Array<{ name: string; value: number }>;
  breakdown: Array<{ name: string; value: number; color?: string }>;
  trend: Array<{
    month: string;
    label: string;
    billed: number;
    profit: number;
    costs: number;
    net: number;
  }>;
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return next.toISOString().slice(0, 10);
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  return date.toLocaleDateString("es-SV", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

async function summarizeMonth(
  month: string,
): Promise<Omit<BalanceSummary, "month">> {
  const start = `${month}-01`;
  const endExclusive = nextMonth(month);
  const supabase = await createClient();

  const [settlementsRes, expensesRes] = await Promise.all([
    supabase
      .from("monthly_settlements")
      .select(
        "billed_amount, own_profit, provider_cost, oldes_cost, commission, tax_amount, extra_costs",
      )
      .eq("period_month", start)
      .is("deleted_at", null),
    supabase
      .from("expense_transactions")
      .select("amount, expense_date")
      .gte("expense_date", start)
      .lt("expense_date", endExclusive)
      .is("deleted_at", null),
  ]);

  const firstError = settlementsRes.error ?? expensesRes.error;
  if (firstError) throw mapPostgresError(firstError);

  const settlements = (settlementsRes.data ?? []) as MonthlySettlement[];
  const expenses = (expensesRes.data ?? []) as ExpenseTransaction[];

  const billedAmount = settlements.reduce(
    (sum, item) => sum + asNumber(item.billed_amount, 0),
    0,
  );
  const settlementProfit = settlements.reduce(
    (sum, item) => sum + asNumber(item.own_profit, 0),
    0,
  );
  const providerCost = settlements.reduce(
    (sum, item) => sum + asNumber(item.provider_cost, 0),
    0,
  );
  const otherSettlementCosts = settlements.reduce(
    (sum, item) =>
      sum +
      asNumber(item.oldes_cost, 0) +
      asNumber(item.commission, 0) +
      asNumber(item.tax_amount, 0) +
      asNumber(item.extra_costs, 0),
    0,
  );
  const operatingExpenses = expenses.reduce(
    (sum, item) => sum + asNumber(item.amount, 0),
    0,
  );

  return {
    billedAmount,
    settlementProfit,
    providerCost,
    otherSettlementCosts,
    operatingExpenses,
    realNetProfit: settlementProfit - operatingExpenses,
  };
}

export async function getBalanceSummary(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<BalanceSummary>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = monthFilterSchema.parse(params);
    const month = filters.month ?? currentMonth();
    const summary = await summarizeMonth(month);
    return actionSuccess({ month, ...summary });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getBalanceDashboard(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<BalanceDashboardData>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = monthFilterSchema.parse(params);
    const month = filters.month ?? currentMonth();
    const summary = await summarizeMonth(month);

    const months = Array.from({ length: 6 }, (_, index) =>
      shiftMonth(month, index - 5),
    );
    const trendSummaries = await Promise.all(
      months.map(async (item) => ({ month: item, ...(await summarizeMonth(item)) })),
    );

    const composition = [
      { name: "Ganancia propia", value: Math.max(0, summary.settlementProfit) },
      { name: "Costo proveedores", value: Math.max(0, summary.providerCost) },
      { name: "Otros costos", value: Math.max(0, summary.otherSettlementCosts) },
      { name: "Gastos operativos", value: Math.max(0, summary.operatingExpenses) },
    ];

    const breakdown = [
      { name: "Facturado", value: summary.billedAmount, color: "#004A99" },
      {
        name: "Ganancia propia",
        value: summary.settlementProfit,
        color: "#16a34a",
      },
      {
        name: "Proveedores",
        value: summary.providerCost,
        color: "#D32F2F",
      },
      {
        name: "Gastos",
        value: summary.operatingExpenses,
        color: "#ca8a04",
      },
      { name: "Neto", value: summary.realNetProfit, color: "#64748b" },
    ];

    const trend = trendSummaries.map((item) => ({
      month: item.month,
      label: monthLabel(item.month),
      billed: item.billedAmount,
      profit: item.settlementProfit,
      costs: item.providerCost + item.operatingExpenses,
      net: item.realNetProfit,
    }));

    return actionSuccess({
      month,
      ...summary,
      composition,
      breakdown,
      trend,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
