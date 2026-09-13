"use server";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { monthFilterSchema } from "@/lib/validation/settlement";
import type {
  ExpenseTransaction,
  MonthlySettlement,
  PartnerRental,
  VendorLedgerEntry,
} from "@/types/database";

export type BalanceSummary = {
  month: string;
  billedAmount: number;
  settlementProfit: number;
  partnerProfit: number;
  vendorPayments: number;
  operatingExpenses: number;
  realNetProfit: number;
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return next.toISOString().slice(0, 10);
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
    const start = `${month}-01`;
    const endExclusive = nextMonth(month);

    const supabase = await createClient();
    const [settlementsRes, partnersRes, paymentsRes, expensesRes] =
      await Promise.all([
        supabase
          .from("monthly_settlements")
          .select("billed_amount, own_profit")
          .eq("period_month", start)
          .is("deleted_at", null),
        supabase
          .from("partner_rentals")
          .select("own_share, status, start_date")
          .gte("start_date", start)
          .lt("start_date", endExclusive)
          .is("deleted_at", null),
        supabase
          .from("vendor_ledger_entries")
          .select("amount, kind, entry_date")
          .eq("kind", "PAYMENT")
          .gte("entry_date", start)
          .lt("entry_date", endExclusive)
          .is("deleted_at", null),
        supabase
          .from("expense_transactions")
          .select("amount, expense_date")
          .gte("expense_date", start)
          .lt("expense_date", endExclusive)
          .is("deleted_at", null),
      ]);

    const firstError =
      settlementsRes.error ??
      partnersRes.error ??
      paymentsRes.error ??
      expensesRes.error;
    if (firstError) throw mapPostgresError(firstError);

    const settlements = (settlementsRes.data ?? []) as MonthlySettlement[];
    const partners = (partnersRes.data ?? []) as PartnerRental[];
    const payments = (paymentsRes.data ?? []) as VendorLedgerEntry[];
    const expenses = (expensesRes.data ?? []) as ExpenseTransaction[];

    const billedAmount = settlements.reduce(
      (sum, item) => sum + Number(item.billed_amount ?? 0),
      0,
    );
    const settlementProfit = settlements.reduce(
      (sum, item) => sum + Number(item.own_profit ?? 0),
      0,
    );
    const partnerProfit = partners
      .filter((item) => !["CANCELLED", "ANNULLED"].includes(item.status))
      .reduce((sum, item) => sum + Number(item.own_share ?? 0), 0);
    const vendorPayments = payments.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );
    const operatingExpenses = expenses.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );

    return actionSuccess({
      month,
      billedAmount,
      settlementProfit,
      partnerProfit,
      vendorPayments,
      operatingExpenses,
      realNetProfit:
        settlementProfit + partnerProfit - vendorPayments - operatingExpenses,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
