"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  vendorLedgerEntrySchema,
  vendorSchema,
  vendorUpdateSchema,
} from "@/lib/validation/settlement";
import type { Vendor, VendorLedgerEntry } from "@/types/database";

export type VendorSummary = Vendor & {
  totalCharged: number;
  totalPaid: number;
  balanceOwed: number;
};

export type VendorDetail = VendorSummary & {
  ledger: VendorLedgerEntry[];
};

function parseVendorForm(formData: FormData) {
  return {
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    notes: formData.get("notes"),
    isActive: formData.get("isActive"),
  };
}

function vendorInputToRow(input: ReturnType<typeof vendorSchema.parse>) {
  return {
    name: input.name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    notes: input.notes ?? null,
    is_active: input.isActive,
  };
}

function parseLedgerForm(formData: FormData) {
  return {
    vendorId: formData.get("vendorId"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    entryDate: formData.get("entryDate"),
    concept: formData.get("concept"),
    settlementId: formData.get("settlementId"),
    contractId: formData.get("contractId"),
    notes: formData.get("notes"),
  };
}

function ledgerInputToRow(
  input: ReturnType<typeof vendorLedgerEntrySchema.parse>,
) {
  return {
    vendor_id: input.vendorId,
    kind: input.kind,
    amount: input.amount,
    entry_date: input.entryDate,
    concept: input.concept,
    settlement_id: input.settlementId ?? null,
    contract_id: input.contractId ?? null,
    notes: input.notes ?? null,
  };
}

function summarizeVendor(vendor: Vendor, ledger: VendorLedgerEntry[]): VendorSummary {
  const totalCharged = ledger
    .filter((entry) => entry.kind === "CHARGE")
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const totalPaid = ledger
    .filter((entry) => entry.kind === "PAYMENT")
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);

  return {
    ...vendor,
    totalCharged,
    totalPaid,
    balanceOwed: totalCharged - totalPaid,
  };
}

export async function listVendors(): Promise<ActionResult<VendorSummary[]>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const [vendorsRes, ledgerRes] = await Promise.all([
      supabase
        .from("vendors")
        .select("*")
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("vendor_ledger_entries")
        .select("*")
        .is("deleted_at", null),
    ]);

    const firstError = vendorsRes.error ?? ledgerRes.error;
    if (firstError) throw mapPostgresError(firstError);

    const ledger = (ledgerRes.data ?? []) as VendorLedgerEntry[];
    const summaries = ((vendorsRes.data ?? []) as Vendor[]).map((vendor) =>
      summarizeVendor(
        vendor,
        ledger.filter((entry) => entry.vendor_id === vendor.id),
      ),
    );

    return actionSuccess(summaries);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getVendor(id: string): Promise<ActionResult<VendorDetail>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const [vendorRes, ledgerRes] = await Promise.all([
      supabase
        .from("vendors")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("vendor_ledger_entries")
        .select("*")
        .eq("vendor_id", id)
        .is("deleted_at", null)
        .order("entry_date", { ascending: false }),
    ]);

    const firstError = vendorRes.error ?? ledgerRes.error;
    if (firstError) throw mapPostgresError(firstError);
    if (!vendorRes.data) return actionError("Proveedor no encontrado.");

    const vendor = vendorRes.data as Vendor;
    const ledger = (ledgerRes.data ?? []) as VendorLedgerEntry[];
    return actionSuccess({ ...summarizeVendor(vendor, ledger), ledger });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createVendor(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("finance.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = vendorSchema.safeParse(parseVendorForm(formData));
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vendors")
      .insert({
        ...vendorInputToRow(parsed.data),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);
    const id = (data as { id: string }).id;

    await writeAuditLog({
      userId: user.id,
      action: "vendor.create",
      entityType: "vendor",
      entityId: id,
      metadata: { name: parsed.data.name },
    });

    revalidatePath("/dashboard/proveedores");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateVendor(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("finance.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = vendorUpdateSchema.safeParse(parseVendorForm(formData));
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const row: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) row.name = parsed.data.name;
    if (parsed.data.phone !== undefined) row.phone = parsed.data.phone ?? null;
    if (parsed.data.email !== undefined) row.email = parsed.data.email ?? null;
    if (parsed.data.notes !== undefined) row.notes = parsed.data.notes ?? null;
    if (parsed.data.isActive !== undefined) row.is_active = parsed.data.isActive;

    const supabase = await createClient();
    const { error } = await supabase
      .from("vendors")
      .update(row)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "vendor.update",
      entityType: "vendor",
      entityId: id,
    });

    revalidatePath("/dashboard/proveedores");
    revalidatePath(`/dashboard/proveedores/${id}`);
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function deleteVendor(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("finance.delete");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("vendors")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "vendor.delete",
      entityType: "vendor",
      entityId: id,
    });

    revalidatePath("/dashboard/proveedores");
    revalidatePath("/dashboard/liquidacion");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createVendorLedgerEntry(
  formData: FormData,
): Promise<ActionResult<{ id: string; vendorId: string }>> {
  try {
    const { user } = await assertPermission("finance.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = vendorLedgerEntrySchema.safeParse(parseLedgerForm(formData));
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vendor_ledger_entries")
      .insert({
        ...ledgerInputToRow(parsed.data),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);
    const id = (data as { id: string }).id;

    await writeAuditLog({
      userId: user.id,
      action: "vendor_ledger.create",
      entityType: "vendor_ledger_entry",
      entityId: id,
      metadata: {
        vendorId: parsed.data.vendorId,
        kind: parsed.data.kind,
        amount: parsed.data.amount,
      },
    });

    revalidatePath("/dashboard/proveedores");
    revalidatePath(`/dashboard/proveedores/${parsed.data.vendorId}`);
    revalidatePath("/dashboard/balance");
    return actionSuccess({ id, vendorId: parsed.data.vendorId });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function deleteVendorLedgerEntry(
  id: string,
  vendorId: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("finance.delete");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("vendor_ledger_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("vendor_id", vendorId)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "vendor_ledger.delete",
      entityType: "vendor_ledger_entry",
      entityId: id,
      metadata: { vendorId },
    });

    revalidatePath("/dashboard/proveedores");
    revalidatePath(`/dashboard/proveedores/${vendorId}`);
    revalidatePath("/dashboard/balance");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
