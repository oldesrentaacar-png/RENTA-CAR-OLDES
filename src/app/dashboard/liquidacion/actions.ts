"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { rentalDaysBetween } from "@/lib/dates";
import { buildVendorRentalConcept } from "@/lib/finance/vendor-rental";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { asNumber } from "@/lib/safe-number";
import { appYearMonth } from "@/lib/dates";
import {
  settlementOwnProfit,
  summarizeSettlementParts,
} from "@/lib/calculations/settlement-balance";
import { createClient } from "@/lib/supabase/server";
import { formatVehicleLabel } from "@/lib/vehicles/label";
import { firstRelation } from "@/lib/validation/form-helpers";
import { monthFilterSchema, settlementSchema } from "@/lib/validation/settlement";
import type { Contract, MonthlySettlement, Vendor } from "@/types/database";
import { getCustomerDisplayName } from "@/lib/customers";

export type SettlementListResult = {
  items: MonthlySettlement[];
  totals: {
    billedAmount: number;
    providerCost: number;
    extraCosts: number;
    ownProfit: number;
  };
  month: string;
};

export type ContractLookupResult = {
  contractId: string;
  contractCode: string;
  customerId: string | null;
  customerName: string;
  vehicleId: string | null;
  vehicleLabel: string;
  plate: string | null;
  startAt: string | null;
  endAt: string | null;
  rentalDays: number | null;
  total: number;
  amountPaid: number;
  isSubleased?: boolean;
  subleasePayeeName?: string | null;
  suggestedProviderCost?: number;
};

function currentMonth(): string {
  return appYearMonth();
}

function parseSettlementForm(formData: FormData) {
  return {
    periodMonth: formData.get("periodMonth"),
    contractId: formData.get("contractId"),
    contractCode: formData.get("contractCode"),
    customerId: formData.get("customerId"),
    customerName: formData.get("customerName"),
    vehicleId: formData.get("vehicleId"),
    vehicleLabel: formData.get("vehicleLabel"),
    plate: formData.get("plate"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    rentalDays: formData.get("rentalDays"),
    billedAmount: formData.get("billedAmount"),
    paymentsReceived: formData.get("paymentsReceived"),
    oldesCost: formData.get("oldesCost"),
    providerCost: formData.get("providerCost"),
    commission: formData.get("commission"),
    taxAmount: formData.get("taxAmount"),
    extraCosts: formData.get("extraCosts"),
    vendorId: formData.get("vendorId"),
    notes: formData.get("notes"),
  };
}

function settlementInputToRow(input: ReturnType<typeof settlementSchema.parse>) {
  const ownProfit = settlementOwnProfit({
    billedAmount: input.billedAmount,
    providerCost: input.providerCost,
    oldesCost: input.oldesCost,
    commission: input.commission,
    taxAmount: input.taxAmount,
    extraCosts: input.extraCosts,
  });

  return {
    period_month: input.periodMonth,
    contract_id: input.contractId ?? null,
    contract_code: input.contractCode ?? null,
    customer_id: input.customerId ?? null,
    customer_name: input.customerName ?? null,
    vehicle_id: input.vehicleId ?? null,
    vehicle_label: input.vehicleLabel ?? null,
    plate: input.plate ?? null,
    start_at: input.startAt ?? null,
    end_at: input.endAt ?? null,
    rental_days: input.rentalDays ?? null,
    billed_amount: input.billedAmount,
    payments_received: input.paymentsReceived,
    oldes_cost: input.oldesCost,
    provider_cost: input.providerCost,
    commission: input.commission,
    tax_amount: input.taxAmount,
    extra_costs: input.extraCosts,
    own_profit: ownProfit,
    vendor_id: input.vendorId ?? null,
    notes: input.notes ?? null,
  };
}

export async function listSettlementVendors(): Promise<
  ActionResult<Array<Pick<Vendor, "id" | "name">>>
> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name");

    if (error) throw mapPostgresError(error);
    return actionSuccess((data ?? []) as Array<Pick<Vendor, "id" | "name">>);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getMonthlySettlement(
  id: string,
): Promise<ActionResult<MonthlySettlement>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("monthly_settlements")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Liquidación no encontrada.");
    return actionSuccess(data as MonthlySettlement);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listMonthlySettlements(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<SettlementListResult>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = monthFilterSchema.parse(params);
    const month = filters.month ?? currentMonth();
    const periodMonth = `${month}-01`;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("monthly_settlements")
      .select("*")
      .eq("period_month", periodMonth)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw mapPostgresError(error);

    const items = (data ?? []) as MonthlySettlement[];
    const balance = summarizeSettlementParts(
      items.map((item) => ({
        billedAmount: item.billed_amount,
        providerCost: item.provider_cost,
        oldesCost: item.oldes_cost,
        commission: item.commission,
        taxAmount: item.tax_amount,
        extraCosts: item.extra_costs,
      })),
    );
    const totals = {
      billedAmount: balance.billedAmount,
      providerCost: balance.providerCost,
      extraCosts: items.reduce(
        (sum, item) => sum + asNumber(item.extra_costs, 0),
        0,
      ),
      ownProfit: balance.settlementProfit,
    };

    return actionSuccess({ items, totals, month });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function lookupContractByCode(
  code: string,
): Promise<ActionResult<ContractLookupResult | null>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const normalizedCode = code.trim();
    if (!normalizedCode) return actionSuccess(null);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contracts")
      .select(
        "id, code, customer_id, vehicle_id, start_at, end_at, total, amount_paid, customers(first_name, last_name, company_name, customer_type), vehicles(brand, model, year, plate, ownership_type, sublease_payee_name)",
      )
      .ilike("code", normalizedCode)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionSuccess(null);

    return actionSuccess(mapContractLookup(data as ContractLookupRow));
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function lookupContractById(
  contractId: string,
): Promise<ActionResult<ContractLookupResult | null>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const id = String(contractId ?? "").trim();
    if (!id) return actionSuccess(null);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contracts")
      .select(
        "id, code, customer_id, vehicle_id, start_at, end_at, total, amount_paid, customers(first_name, last_name, company_name, customer_type), vehicles(brand, model, year, plate, ownership_type, sublease_payee_name)",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionSuccess(null);

    return actionSuccess(mapContractLookup(data as ContractLookupRow));
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

type ContractLookupRow = Contract & {
  customers:
    | {
        first_name: string | null;
        last_name: string | null;
        company_name: string | null;
        customer_type: string | null;
      }
    | Array<{
        first_name: string | null;
        last_name: string | null;
        company_name: string | null;
        customer_type: string | null;
      }>
    | null;
  vehicles:
    | {
        brand: string | null;
        model: string | null;
        year: number | null;
        plate: string | null;
        ownership_type?: string | null;
        sublease_payee_name?: string | null;
      }
    | Array<{
        brand: string | null;
        model: string | null;
        year: number | null;
        plate: string | null;
        ownership_type?: string | null;
        sublease_payee_name?: string | null;
      }>
    | null;
};

function mapContractLookup(raw: ContractLookupRow): ContractLookupResult {
  const customer = firstRelation(raw.customers);
  const vehicle = firstRelation(raw.vehicles);
  const customerName = customer
    ? getCustomerDisplayName({
        customer_type: (customer.customer_type as "PERSON" | "COMPANY" | null) ?? "PERSON",
        first_name: customer.first_name ?? "",
        last_name: customer.last_name ?? "",
        company_name: customer.company_name ?? null,
      })
    : "";
  const vehicleLabel = formatVehicleLabel(vehicle);
  const isSubleased =
    String(vehicle?.ownership_type ?? "").toUpperCase() === "SUBLEASED";

  return {
    contractId: raw.id,
    contractCode: raw.code,
    customerId: raw.customer_id,
    customerName,
    vehicleId: raw.vehicle_id,
    vehicleLabel,
    plate: vehicle?.plate ?? null,
    startAt: raw.start_at,
    endAt: raw.end_at,
    rentalDays:
      raw.start_at && raw.end_at
        ? rentalDaysBetween(raw.start_at, raw.end_at)
        : null,
    total: asNumber(raw.total, 0),
    amountPaid: asNumber(raw.amount_paid, 0),
    isSubleased,
    subleasePayeeName: vehicle?.sublease_payee_name?.trim() || null,
  };
}

export async function createMonthlySettlement(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("finance.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = settlementSchema.safeParse(parseSettlementForm(formData));
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const row = settlementInputToRow(parsed.data);
    let vendorName: string | null = null;

    if (parsed.data.vendorId) {
      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .select("name")
        .eq("id", parsed.data.vendorId)
        .is("deleted_at", null)
        .maybeSingle();
      if (vendorError) throw mapPostgresError(vendorError);
      vendorName = (vendor as { name: string } | null)?.name ?? null;
    }

    const { data, error } = await supabase
      .from("monthly_settlements")
      .insert({
        ...row,
        vendor_name: vendorName,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);
    const id = (data as { id: string }).id;

    await syncVendorSettlementCharge(supabase, {
      userId: user.id,
      settlementId: id,
      vendorId: parsed.data.vendorId ?? null,
      providerCost: parsed.data.providerCost,
      entryDate: parsed.data.periodMonth,
      concept: vendorChargeConcept(parsed.data),
      contractId: parsed.data.contractId ?? null,
      notes: parsed.data.notes ?? null,
    });

    await writeAuditLog({
      userId: user.id,
      action: "settlement.create",
      entityType: "monthly_settlement",
      entityId: id,
      metadata: {
        periodMonth: parsed.data.periodMonth,
        billedAmount: parsed.data.billedAmount,
        ownProfit: row.own_profit,
      },
    });

    revalidatePath("/dashboard/liquidacion");
    revalidatePath("/dashboard/proveedores");
    revalidatePath("/dashboard/balance");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateMonthlySettlement(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("finance.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = settlementSchema.safeParse(parseSettlementForm(formData));
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    let vendorName: string | null = null;
    if (parsed.data.vendorId) {
      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .select("name")
        .eq("id", parsed.data.vendorId)
        .is("deleted_at", null)
        .maybeSingle();
      if (vendorError) throw mapPostgresError(vendorError);
      vendorName = (vendor as { name: string } | null)?.name ?? null;
    }

    const { error } = await supabase
      .from("monthly_settlements")
      .update({
        ...settlementInputToRow(parsed.data),
        vendor_name: vendorName,
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await syncVendorSettlementCharge(supabase, {
      userId: user.id,
      settlementId: id,
      vendorId: parsed.data.vendorId ?? null,
      providerCost: parsed.data.providerCost,
      entryDate: parsed.data.periodMonth,
      concept: vendorChargeConcept(parsed.data),
      contractId: parsed.data.contractId ?? null,
      notes: parsed.data.notes ?? null,
    });

    await writeAuditLog({
      userId: user.id,
      action: "settlement.update",
      entityType: "monthly_settlement",
      entityId: id,
    });

    revalidatePath("/dashboard/liquidacion");
    revalidatePath("/dashboard/proveedores");
    revalidatePath("/dashboard/balance");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

function vendorChargeConcept(input: {
  contractCode?: string | null;
  vehicleLabel?: string | null;
  plate?: string | null;
  rentalDays?: number | null;
  startAt?: string | null;
  endAt?: string | null;
}): string {
  return (
    buildVendorRentalConcept(input) || "Cargo por liquidación"
  );
}

async function syncVendorSettlementCharge(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    userId: string;
    settlementId: string;
    vendorId: string | null;
    providerCost: number;
    entryDate: string;
    concept: string;
    contractId: string | null;
    notes: string | null;
  },
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("vendor_ledger_entries")
    .select("id")
    .eq("settlement_id", input.settlementId)
    .eq("kind", "CHARGE")
    .is("deleted_at", null);
  if (existingError) throw mapPostgresError(existingError);

  const rows = (existing ?? []) as Array<{ id: string }>;
  const now = new Date().toISOString();

  if (!input.vendorId || input.providerCost <= 0) {
    if (rows.length === 0) return;
    const { error } = await supabase
      .from("vendor_ledger_entries")
      .update({ deleted_at: now })
      .in(
        "id",
        rows.map((row) => row.id),
      );
    if (error) throw mapPostgresError(error);
    return;
  }

  const payload = {
    vendor_id: input.vendorId,
    amount: input.providerCost,
    entry_date: input.entryDate,
    concept: input.concept,
    contract_id: input.contractId,
    notes: input.notes,
    updated_at: now,
  };

  if (rows.length === 0) {
    const { error } = await supabase.from("vendor_ledger_entries").insert({
      ...payload,
      kind: "CHARGE",
      settlement_id: input.settlementId,
      created_by: input.userId,
    });
    if (error) throw mapPostgresError(error);
    return;
  }

  const [keep, ...duplicates] = rows;
  const { error: updateError } = await supabase
    .from("vendor_ledger_entries")
    .update(payload)
    .eq("id", keep.id);
  if (updateError) throw mapPostgresError(updateError);

  if (duplicates.length > 0) {
    const { error } = await supabase
      .from("vendor_ledger_entries")
      .update({ deleted_at: now })
      .in(
        "id",
        duplicates.map((row) => row.id),
      );
    if (error) throw mapPostgresError(error);
  }
}

export async function deleteMonthlySettlement(
  id: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("finance.delete");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("monthly_settlements")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    const { error: ledgerError } = await supabase
      .from("vendor_ledger_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("settlement_id", id)
      .eq("kind", "CHARGE")
      .is("deleted_at", null);
    if (ledgerError) throw mapPostgresError(ledgerError);

    await writeAuditLog({
      userId: user.id,
      action: "settlement.delete",
      entityType: "monthly_settlement",
      entityId: id,
    });

    revalidatePath("/dashboard/liquidacion");
    revalidatePath("/dashboard/proveedores");
    revalidatePath("/dashboard/balance");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
