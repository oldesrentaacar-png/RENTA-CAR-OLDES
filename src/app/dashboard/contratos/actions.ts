"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import {
  mapContractRow,
  mapContractSignatureRow,
  mapCustomerRow,
  mapReservationRow,
  mapVehicleRow,
  type ContractRow,
  type ContractSignatureRow,
  type CustomerRow,
  type ReservationRow,
  type VehicleRow,
} from "@/lib/db/mappers";
import {
  formatAppDate,
  formatAppDateTime,
  formatAppTime,
  normalizeFormDateTimeToIso,
  rentalDaysBetween,
} from "@/lib/dates";
import { getCustomerDisplayName } from "@/lib/customers";
import {
  CONTRACT_DISPLAY_PHASE_LABELS,
  deriveContractDisplayPhase,
  type ContractDisplayPhase,
} from "@/lib/contracts/display-phase";
import { mergeObservationTexts } from "@/lib/contracts/observations";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { canManageCourtesyDiscount } from "@/lib/auth/permissions";
import { formatVehicleLabel } from "@/lib/vehicles/label";
import { applyVehicleMileage } from "@/lib/vehicles/mileage";
import { syncReservationFromContract } from "@/lib/contracts/sync-reservation";
import { calculateReservationTotal } from "@/lib/calculations/quote";
import {
  extraLinesFromQuoteItems,
  normalizeExtraLineItems,
  parseExtraLineItemsFromForm,
  reconcileNamedExtrasWithLump,
  sumExtraLineItems,
  type ExtraLineItem,
} from "@/lib/billing/extra-lines";
import {
  OLDES_ACCESSORIES,
  OLDES_CONTRACT_CLAUSES,
  amountToSpanishUsd,
  damageSymbol,
  deductibleForVehicleType,
  filterContractClauseBody,
  resolveIncludePagare,
  resolvePdfBusinessContact,
  shouldIncludePagare,
} from "@/lib/contracts/oldes-terms";
import {
  getDefaultChecklistFromCatalog,
  listAccessoryCatalog,
} from "@/lib/inspections/accessory-catalog";
import {
  DEFAULT_CHECKLIST_ITEMS,
  FUEL_LEVEL_LABELS,
  PHOTO_CATEGORY_LABELS,
  DAMAGE_TYPE_LABELS,
} from "@/lib/inspections/defaults";
import { buildDeliverySteps } from "@/lib/contracts/delivery-steps";
import {
  buildContractBillingBreakdown,
  computeOptionalIvaTotals,
} from "@/lib/pdf/contract-billing";
import { parseMoneyInput } from "@/lib/money";
import { resolvePrivateFileUrl, uploadSignatureImage } from "@/lib/storage/private-upload";
import { createClient } from "@/lib/supabase/server";
import { firstRelation } from "@/lib/validation/form-helpers";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Never inserts a duplicate (contract_id, signer_type) — uses DB ON CONFLICT. */
async function saveContractSignature(
  supabase: SupabaseServer,
  input: {
    contractId: string;
    signerType: string;
    signedByName: string;
    signaturePath: string;
    signedByUserId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): Promise<void> {
  const { data, error } = await supabase.rpc("upsert_contract_signature", {
    p_contract_id: input.contractId,
    p_signer_type: input.signerType,
    p_signed_by_name: input.signedByName,
    p_signature_path: input.signaturePath,
    p_signed_by_user_id: input.signedByUserId ?? null,
    p_ip_address: input.ipAddress ?? null,
    p_user_agent: input.userAgent ?? null,
  });

  if (!error && data) return;

  // Fallback if RPC not yet deployed: client upsert still avoids duplicates.
  const { error: upsertError } = await supabase.from("contract_signatures").upsert(
    {
      contract_id: input.contractId,
      signer_type: input.signerType,
      signed_by_name: input.signedByName,
      signed_by_user_id: input.signedByUserId ?? null,
      signature_path: input.signaturePath,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    },
    { onConflict: "contract_id,signer_type" },
  );

  if (upsertError) {
    if (error) throw mapPostgresError(error);
    throw mapPostgresError(upsertError);
  }
}
import {
  contractSchema,
  contractSearchSchema,
  contractSignSchema,
} from "@/lib/validation/contract";
import type {
  Contract,
  ContractSignature,
  ContractStatus,
} from "@/types/database";
import type { PaginatedResult } from "@/types/api";
import type { DeliveryStep } from "@/components/contracts/delivery-checklist";

export type ContractDetail = Contract & {
  signatures: ContractSignature[];
  customerName: string;
  vehicleLabel: string;
  plate: string;
  reservationCode: string;
  /** Pagaré mercantil (solo clientes locales). */
  includePagare: boolean;
  /** IVA opcional en PDF / total. */
  applyIva: boolean;
  taxRate: number;
  taxAmount: number;
  pagareAmount: number;
  /** Vehicle is third-party sublease — show cost-split CTA when closed. */
  isSubleased: boolean;
  subleasePayeeName: string | null;
  /** Existing monthly settlement for this contract, if any. */
  settlementId: string | null;
};

export type ContractListItem = Contract & {
  customerName: string;
  vehicleLabel: string;
  plate: string;
  displayPhase: import("@/lib/contracts/display-phase").ContractDisplayPhase;
  displayPhaseLabel: string;
};

function nextStatusAfterSign(
  hasClient: boolean,
  hasRepresentative: boolean,
): ContractStatus {
  if (hasClient) return "CLIENT_SIGNED";
  if (hasRepresentative) return "REPRESENTATIVE_SIGNED";
  return "PENDING";
}

async function ensureRepresentativeSignature(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contractId: string,
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
  operatorSignatureDataUrl?: string | null,
): Promise<string | undefined> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, signature_url")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return "Configure su nombre y firma en Mi perfil (menú de usuario).";
  }

  const operator = profile as {
    first_name: string;
    last_name: string;
    signature_url?: string | null;
  };
  const operatorName = `${operator.first_name} ${operator.last_name}`.trim();
  if (!operatorName) {
    return "Configure su nombre en Mi perfil para registrar la firma del operador.";
  }

  const sourceDataUrl =
    operatorSignatureDataUrl?.startsWith("data:")
      ? operatorSignatureDataUrl
      : operator.signature_url?.startsWith("data:")
        ? operator.signature_url
        : null;

  let signaturePath: string | null = null;
  if (sourceDataUrl) {
    const upload = await uploadSignatureImage(
      contractId,
      "REPRESENTATIVE",
      sourceDataUrl,
    );
    signaturePath = upload.storagePath;
    // Persist on profile for next contracts.
    if (!operator.signature_url || operatorSignatureDataUrl) {
      await supabase
        .from("profiles")
        .update({ signature_url: sourceDataUrl })
        .eq("id", userId);
    }
  } else if (operator.signature_url) {
    signaturePath = operator.signature_url;
  }

  if (!signaturePath) {
    return "Falta su firma de operador. Guárdela en Mi perfil (menú usuario) o dibújela en esta pantalla.";
  }

  // Never collide on UNIQUE(contract_id, signer_type).
  try {
    await saveContractSignature(supabase, {
      contractId,
      signerType: "REPRESENTATIVE",
      signedByName: operatorName,
      signaturePath,
      signedByUserId: userId,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error(
      "[ensureRepresentativeSignature] save failed",
      error instanceof Error ? error.message : error,
    );
    return "La firma del cliente se guardó, pero no se pudo registrar la firma del operador. Recargue e intente de nuevo.";
  }

  return undefined;
}

export type DeliveryFlowContext = {
  contractId: string;
  steps: DeliveryStep[];
  currentStepId?: string;
};

export async function getDeliveryFlowForReservation(
  reservationId: string,
  options?: {
    currentStepId?: string;
  },
): Promise<ActionResult<DeliveryFlowContext | null>> {
  try {
    await assertPermission("contracts.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: contract, error } = await supabase
      .from("contracts")
      .select(
        "id, reservation_id, amount_paid, pdf_path, customers(first_name, last_name), vehicles(brand, model, year, plate)",
      )
      .eq("reservation_id", reservationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!contract) return actionSuccess(null);

    const raw = contract as {
      id: string;
      reservation_id: string;
      amount_paid?: number | null;
      pdf_path?: string | null;
      customers:
        | { first_name: string; last_name: string }
        | Array<{ first_name: string; last_name: string }>;
      vehicles:
        | { brand: string; model: string; year: number; plate: string }
        | Array<{ brand: string; model: string; year: number; plate: string }>;
    };
    const customers = Array.isArray(raw.customers)
      ? raw.customers[0]
      : raw.customers;
    const vehicles = Array.isArray(raw.vehicles) ? raw.vehicles[0] : raw.vehicles;
    if (!customers || !vehicles) return actionSuccess(null);

    const progress = await getContractDeliveryProgress(raw.id);
    if (!progress.success) return actionError(progress.error);

    const customerName = `${customers.first_name} ${customers.last_name}`;
    const vehicleLabel = formatVehicleLabel(vehicles);

    const steps = buildDeliverySteps({
      contractId: raw.id,
      reservationId: raw.reservation_id,
      customerName,
      vehicleLabel,
      checkOutId: progress.data.checkOutId,
      checkOutChecklistCount: progress.data.checkOutChecklistCount,
      amountPaid: progress.data.amountPaid,
      hasClientSignature: progress.data.hasClientSignature,
      hasRepresentativeSignature: progress.data.hasRepresentativeSignature,
      hasPdf: progress.data.hasPdf,
      updatedAt: (raw as { updated_at?: string }).updated_at,
    });

    return actionSuccess({
      contractId: raw.id,
      steps,
      currentStepId: options?.currentStepId,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listContracts(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<ContractListItem>>> {
  try {
    await assertPermission("contracts.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = contractSearchSchema.parse({
      query: params.q,
      status: params.status,
      customerId: params.customerId,
      vehicleId: params.vehicleId,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();

    let matchingCustomerIds: string[] | null = null;
    if (filters.query) {
      const term = filters.query.trim();
      const { data: matchingCustomers } = await supabase
        .from("customers")
        .select("id")
        .is("deleted_at", null)
        .or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,company_name.ilike.%${term}%`,
        );
      matchingCustomerIds = (matchingCustomers ?? []).map(
        (row) => (row as { id: string }).id,
      );
    }

    let query = supabase
      .from("contracts")
      .select(
        "*, customers(first_name, last_name, company_name, customer_type), vehicles(brand, model, plate)",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const phaseFilter = filters.status as ContractDisplayPhase | undefined;
    const nowIso = new Date().toISOString();
    if (phaseFilter === "ANULADO") {
      query = query.eq("status", "CANCELLED");
    } else if (phaseFilter === "FINALIZADO") {
      query = query.eq("status", "COMPLETED");
    } else if (phaseFilter === "SIN_RESOLVER") {
      query = query
        .not("status", "in", '("COMPLETED","CANCELLED")')
        .is("closed_at", null)
        .lt("end_at", nowIso);
    } else if (phaseFilter === "EN_CURSO") {
      query = query
        .not("status", "in", '("COMPLETED","CANCELLED")')
        .is("closed_at", null)
        .gte("end_at", nowIso);
    } else if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.customerId) query = query.eq("customer_id", filters.customerId);
    if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
    if (filters.query) {
      const term = filters.query.trim();
      if (matchingCustomerIds && matchingCustomerIds.length > 0) {
        query = query.or(
          `code.ilike.%${term}%,customer_id.in.(${matchingCustomerIds.join(",")})`,
        );
      } else {
        query = query.ilike("code", `%${term}%`);
      }
    }

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    type Row = ContractRow & {
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
            plate: string | null;
          }
        | Array<{
            brand: string | null;
            model: string | null;
            plate: string | null;
          }>
        | null;
    };

    const items: ContractListItem[] = ((data ?? []) as Row[]).map((row) => {
      const contract = mapContractRow(row);
      const customer = Array.isArray(row.customers)
        ? row.customers[0]
        : row.customers;
      const vehicle = Array.isArray(row.vehicles)
        ? row.vehicles[0]
        : row.vehicles;

      const customerName = customer
        ? getCustomerDisplayName({
            customer_type:
              (customer.customer_type as "PERSON" | "COMPANY" | null) ??
              "PERSON",
            first_name: customer.first_name ?? "",
            last_name: customer.last_name ?? "",
            company_name: customer.company_name,
          })
        : "—";

      const vehicleLabel = formatVehicleLabel(vehicle);
      const plate = vehicle?.plate?.trim() || "";
      const displayPhase = deriveContractDisplayPhase({
        status: contract.status,
        closedAt: contract.closed_at,
        endAt: contract.end_at,
      });

      return {
        ...contract,
        customerName,
        vehicleLabel,
        plate: plate || "—",
        displayPhase,
        displayPhaseLabel: CONTRACT_DISPLAY_PHASE_LABELS[displayPhase],
      };
    });

    return actionSuccess({
      items,
      total: count ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / filters.pageSize)),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getContract(
  id: string,
): Promise<ActionResult<ContractDetail>> {
  try {
    await assertPermission("contracts.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contracts")
      .select(
        "*, customers(first_name, last_name, country, dui, passport), vehicles(brand, model, year, plate, category, ownership_type, sublease_payee_name, vehicle_types(slug, name)), reservations(code)",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Contrato no encontrado.");

    const row = data as ContractRow & {
      customers:
        | {
            first_name: string;
            last_name: string;
            country: string | null;
            dui: string | null;
            passport: string | null;
          }
        | Array<{
            first_name: string;
            last_name: string;
            country: string | null;
            dui: string | null;
            passport: string | null;
          }>;
      vehicles:
        | {
            brand: string;
            model: string;
            year: number;
            plate: string;
            category: string | null;
            ownership_type?: string | null;
            sublease_payee_name?: string | null;
            vehicle_types: { slug: string; name: string } | null;
          }
        | Array<{
            brand: string;
            model: string;
            year: number;
            plate: string;
            category: string | null;
            ownership_type?: string | null;
            sublease_payee_name?: string | null;
            vehicle_types: { slug: string; name: string } | null;
          }>;
      reservations: { code: string } | Array<{ code: string }>;
    };

    const customers = Array.isArray(row.customers)
      ? row.customers[0]
      : row.customers;
    const vehicles = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
    const reservations = Array.isArray(row.reservations)
      ? row.reservations[0]
      : row.reservations;

    if (!customers || !vehicles || !reservations) {
      return actionError(
        "Datos incompletos del contrato (cliente, vehículo o reserva).",
      );
    }

    const { data: signatures, error: sigError } = await supabase
      .from("contract_signatures")
      .select("*")
      .eq("contract_id", id);

    if (sigError) throw mapPostgresError(sigError);

    const { data: settlementRow } = await supabase
      .from("monthly_settlements")
      .select("id")
      .eq("contract_id", id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    const contract = mapContractRow(row);
    const includePagare = resolveIncludePagare(contract.include_pagare, {
      country: customers.country,
      dui: customers.dui,
      passport: customers.passport,
    });
    const pagareAmount = deductibleForVehicleType(
      vehicles.vehicle_types?.slug ??
        vehicles.vehicle_types?.name ??
        vehicles.category,
    );

    return actionSuccess({
      ...contract,
      signatures: ((signatures ?? []) as ContractSignatureRow[]).map(
        mapContractSignatureRow,
      ),
      customerName: `${customers.first_name} ${customers.last_name}`,
      vehicleLabel: formatVehicleLabel(vehicles),
      plate: vehicles.plate,
      reservationCode: reservations.code,
      includePagare,
      applyIva: Boolean(contract.apply_iva),
      taxRate: Number(contract.tax_rate ?? 0.13),
      taxAmount: Number(contract.tax_amount ?? 0),
      pagareAmount,
      isSubleased: String(vehicles.ownership_type ?? "").toUpperCase() === "SUBLEASED",
      subleasePayeeName: vehicles.sublease_payee_name?.trim() || null,
      settlementId: (settlementRow as { id: string } | null)?.id ?? null,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export type ContractEligibleReservation = {
  id: string;
  code: string;
  status: string;
  start_at: string;
  end_at: string;
  customerName: string;
  vehicleLabel: string;
  total: number;
};

/** Active/confirmed reservations that do not yet have an open contract. */
export async function listReservationsEligibleForContract(
  params: { q?: string } = {},
): Promise<ActionResult<ContractEligibleReservation[]>> {
  try {
    await assertPermission("contracts.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const queryText = params.q?.trim() ?? "";

    let matchingCustomerIds: string[] = [];
    if (queryText) {
      const { data: matchingCustomers } = await supabase
        .from("customers")
        .select("id")
        .is("deleted_at", null)
        .or(
          `first_name.ilike.%${queryText}%,last_name.ilike.%${queryText}%,company_name.ilike.%${queryText}%`,
        );
      matchingCustomerIds = (matchingCustomers ?? []).map(
        (row) => (row as { id: string }).id,
      );
    }

    let query = supabase
      .from("reservations")
      .select(
        "id, code, status, start_at, end_at, total, customers(first_name, last_name, company_name, customer_type), vehicles(brand, model, plate, year)",
      )
      .is("deleted_at", null)
      .in("status", ["CONFIRMED", "ACTIVE"])
      .order("start_at", { ascending: true })
      .limit(80);

    if (queryText) {
      if (matchingCustomerIds.length > 0) {
        query = query.or(
          `code.ilike.%${queryText}%,customer_id.in.(${matchingCustomerIds.join(",")})`,
        );
      } else {
        query = query.ilike("code", `%${queryText}%`);
      }
    }

    const { data, error } = await query;
    if (error) throw mapPostgresError(error);

    const reservationIds = (data ?? []).map(
      (row) => (row as { id: string }).id,
    );

    const blocked = new Set<string>();
    if (reservationIds.length > 0) {
      const { data: existingContracts, error: contractsError } = await supabase
        .from("contracts")
        .select("reservation_id, status")
        .in("reservation_id", reservationIds)
        .is("deleted_at", null)
        .neq("status", "CANCELLED");

      if (contractsError) throw mapPostgresError(contractsError);
      for (const row of existingContracts ?? []) {
        const reservationId = (row as { reservation_id: string }).reservation_id;
        if (reservationId) blocked.add(reservationId);
      }
    }

    const items: ContractEligibleReservation[] = [];
    for (const raw of data ?? []) {
      const row = raw as {
        id: string;
        code: string;
        status: string;
        start_at: string;
        end_at: string;
        total: number;
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
              plate: string | null;
              year: number | null;
            }
          | Array<{
              brand: string | null;
              model: string | null;
              plate: string | null;
              year: number | null;
            }>
          | null;
      };

      if (blocked.has(row.id)) continue;

      const customer = firstRelation(row.customers);
      const vehicle = firstRelation(row.vehicles);
      const customerName = customer
        ? getCustomerDisplayName({
            customer_type:
              (customer.customer_type as "PERSON" | "COMPANY" | null) ??
              "PERSON",
            first_name: customer.first_name ?? "",
            last_name: customer.last_name ?? "",
            company_name: customer.company_name,
          })
        : "Cliente";
      const vehicleLabel = formatVehicleLabel(vehicle);

      items.push({
        id: row.id,
        code: row.code,
        status: row.status,
        start_at: row.start_at,
        end_at: row.end_at,
        customerName,
        vehicleLabel,
        total: Number(row.total ?? 0),
      });
    }

    return actionSuccess(items);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getContractPrefillFromReservation(
  reservationId: string,
): Promise<
  ActionResult<{
    reservation: ReturnType<typeof mapReservationRow>;
    customer: ReturnType<typeof mapCustomerRow>;
    vehicle: ReturnType<typeof mapVehicleRow>;
    defaultTerms: string | null;
  }>
> {
  try {
    await assertPermission("contracts.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: reservation, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!reservation) return actionError("Reserva no encontrada.");

    const mappedReservation = mapReservationRow(reservation as ReservationRow);

    const [{ data: customer }, { data: vehicle }, { data: settings }] =
      await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .eq("id", mappedReservation.customer_id)
          .maybeSingle(),
        supabase
          .from("vehicles")
          .select("*")
          .eq("id", mappedReservation.vehicle_id)
          .maybeSingle(),
        supabase.from("business_settings").select("contract_terms").limit(1).maybeSingle(),
      ]);

    if (!customer || !vehicle) {
      return actionError("Cliente o vehículo no encontrado.");
    }

    return actionSuccess({
      reservation: mappedReservation,
      customer: mapCustomerRow(customer as CustomerRow),
      vehicle: mapVehicleRow(vehicle as VehicleRow),
      defaultTerms:
        (settings as { contract_terms?: string | null } | null)?.contract_terms ||
        OLDES_CONTRACT_CLAUSES.join("\n\n"),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createContract(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("contracts.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = contractSchema.safeParse({
      reservationId: formData.get("reservationId"),
      terms: formData.get("terms"),
      clauses: formData.get("clauses"),
      notes: formData.get("notes"),
      status: formData.get("status") || "PENDING",
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data: reservation, error: resError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", parsed.data.reservationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (resError) throw mapPostgresError(resError);
    if (!reservation) return actionError("Reserva no encontrada.");

    const { data: existingContract } = await supabase
      .from("contracts")
      .select("id, code")
      .eq("reservation_id", parsed.data.reservationId)
      .neq("status", "CANCELLED")
      .is("deleted_at", null)
      .maybeSingle();

    if (existingContract) {
      const code = (existingContract as { code: string }).code;
      return actionError(
        `Ya existe un contrato (${code}) para esta reserva. Ábralo desde Contratos.`,
      );
    }

    const r = mapReservationRow(reservation as ReservationRow);

    const startAt = normalizeFormDateTimeToIso(
      formData.get("startAt") ?? r.start_at,
    );
    const endAt = normalizeFormDateTimeToIso(formData.get("endAt") ?? r.end_at);
    const agreedRate = parseMoneyInput(
      formData.get("agreedRate"),
      r.agreed_rate,
    );
    const deposit = parseMoneyInput(formData.get("deposit"), r.deposit);
    const insurance = parseMoneyInput(formData.get("insurance"), r.insurance);
    const additionalCostsForm = parseMoneyInput(
      formData.get("additionalCosts"),
      r.additional_costs,
    );
    let namedExtras = parseExtraLineItemsFromForm(
      formData.get("extraLineItems"),
    );
    if (namedExtras === undefined) {
      namedExtras = normalizeExtraLineItems(r.extra_line_items);
    }
    if (namedExtras.length === 0 && r.quote_id) {
      const { data: quoteItems } = await supabase
        .from("quote_items")
        .select("description, amount, quantity, unit_price, item_type")
        .eq("quote_id", r.quote_id);
      namedExtras = extraLinesFromQuoteItems(quoteItems);
    }
    const extraLineItems = reconcileNamedExtrasWithLump({
      named: namedExtras,
      lumpAmount: additionalCostsForm,
      residualLabel: "Ajuste / otros de cotización",
      lumpLabel: "Costos adicionales (desde reserva)",
    });
    const additionalCosts = sumExtraLineItems(extraLineItems);
    const canCourtesy = await canManageCourtesyDiscount(user.id);
    const courtesyAmount = canCourtesy
      ? parseMoneyInput(
          formData.get("courtesyAmount"),
          r.courtesy_amount ?? 0,
        )
      : Number(r.courtesy_amount ?? 0);
    const courtesyDetail = canCourtesy
      ? String(formData.get("courtesyDetail") ?? "").trim() ||
        r.courtesy_detail ||
        null
      : r.courtesy_detail ?? null;
    const computed = calculateReservationTotal({
      startAt,
      endAt,
      agreedRate,
      insurance,
      additionalCosts,
      courtesyAmount,
    });

    const { data: customerRow } = await supabase
      .from("customers")
      .select("country, dui, passport, customer_type")
      .eq("id", r.customer_id)
      .maybeSingle();

    const includePagareDefault = shouldIncludePagare({
      country: (customerRow as { country?: string | null } | null)?.country,
      dui: (customerRow as { dui?: string | null } | null)?.dui,
      passport: (customerRow as { passport?: string | null } | null)?.passport,
    });

    const applyIvaExplicit = formData.has("applyIva");
    const applyIva = applyIvaExplicit
      ? formData.get("applyIva") === "true" ||
        formData.get("applyIva") === "on" ||
        formData.get("applyIva") === "1"
      : Boolean(r.apply_iva);
    const taxRateRaw = Number(formData.get("taxRate") || r.tax_rate || 13);
    const taxRate =
      taxRateRaw > 1 ? taxRateRaw / 100 : Math.max(0, taxRateRaw || 0.13);
    const ivaTotals = computeOptionalIvaTotals({
      pretaxTotal: computed.total,
      applyIva,
      taxRate,
    });

    const { data, error } = await supabase
      .from("contracts")
      .insert({
        reservation_id: parsed.data.reservationId,
        customer_id: r.customer_id,
        vehicle_id: r.vehicle_id,
        start_at: startAt,
        end_at: endAt,
        agreed_rate: agreedRate,
        deposit,
        insurance,
        total: ivaTotals.total,
        subtotal: ivaTotals.pretaxTotal,
        apply_iva: applyIva,
        tax_rate: ivaTotals.taxRate,
        tax_amount: ivaTotals.taxAmount,
        courtesy_amount: courtesyAmount,
        courtesy_detail: courtesyDetail,
        extra_line_items: extraLineItems,
        terms: parsed.data.terms ?? null,
        clauses: parsed.data.clauses ?? null,
        notes: parsed.data.notes ?? null,
        status: parsed.data.status,
        include_pagare: includePagareDefault,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;

    await syncReservationFromContract(supabase, {
      reservationId: parsed.data.reservationId,
      startAt,
      endAt,
      agreedRate,
      deposit,
      insurance,
      total: ivaTotals.total,
      courtesyAmount,
      courtesyDetail,
      vehicleId: r.vehicle_id,
      status: "CONFIRMED",
      additionalCosts,
      extraLineItems,
    });

    await writeAuditLog({
      userId: user.id,
      action: "contract.create",
      entityType: "contract",
      entityId: id,
      metadata: {
        reservationId: parsed.data.reservationId,
        migratedFromReservation: true,
      },
    });

    revalidatePath("/dashboard/contratos");
    revalidatePath(`/dashboard/contratos/${id}`);
    revalidatePath("/dashboard/reservas");
    revalidatePath(`/dashboard/reservas/${parsed.data.reservationId}`);
    revalidatePath("/dashboard/calendario");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateContract(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("contracts.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("contracts")
      .select(
        "status, reservation_id, start_at, end_at, agreed_rate, deposit, insurance, total, courtesy_amount, courtesy_detail, vehicle_id, extra_line_items, apply_iva, tax_rate",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) throw mapPostgresError(existingError);
    if (!existing) return actionError("Contrato no encontrado.");

    const current = existing as {
      status: ContractStatus;
      reservation_id: string;
      start_at: string;
      end_at: string;
      agreed_rate: number;
      deposit: number;
      insurance: number;
      total: number;
      courtesy_amount?: number | null;
      courtesy_detail?: string | null;
      vehicle_id: string;
      extra_line_items?: ExtraLineItem[] | null;
      apply_iva?: boolean;
      tax_rate?: number;
    };

    if (current.status === "COMPLETED" || current.status === "CANCELLED") {
      return actionError("No se puede editar un contrato completado o cancelado.");
    }

    const row: Record<string, unknown> = {};
    const terms = formData.get("terms");
    const clauses = formData.get("clauses");
    const notes = formData.get("notes");

    if (terms !== null) row.terms = String(terms).trim() || null;
    if (clauses !== null) row.clauses = String(clauses).trim() || null;
    if (notes !== null) row.notes = String(notes).trim() || null;

    const agreedRate = formData.get("agreedRate");
    const deposit = formData.get("deposit");
    const insurance = formData.get("insurance");
    const startAt = formData.get("startAt");
    const endAt = formData.get("endAt");

    // Extensiones / ajustes: fechas y tarifa se editan en el contrato (fuente de verdad),
    // incluso después de firmar (p. ej. extender renta desde calendario → contrato).
    if (agreedRate) row.agreed_rate = Number(agreedRate);
    if (deposit) row.deposit = Number(deposit);
    if (insurance) row.insurance = Number(insurance);
    if (startAt) row.start_at = normalizeFormDateTimeToIso(startAt);
    if (endAt) row.end_at = normalizeFormDateTimeToIso(endAt);

    const nextStart =
      (row.start_at as string | undefined) ?? current.start_at;
    const nextEnd = (row.end_at as string | undefined) ?? current.end_at;
    const nextRate =
      (row.agreed_rate as number | undefined) ?? current.agreed_rate;
    const nextInsurance =
      (row.insurance as number | undefined) ?? current.insurance;
    const nextDeposit =
      (row.deposit as number | undefined) ?? current.deposit;

    const datesOrMoneyChanged =
      Boolean(startAt) ||
      Boolean(endAt) ||
      Boolean(agreedRate) ||
      Boolean(insurance);

    if (datesOrMoneyChanged) {
      const extras = normalizeExtraLineItems(current.extra_line_items);
      const additionalCosts = sumExtraLineItems(extras);
      const computed = calculateReservationTotal({
        startAt: nextStart,
        endAt: nextEnd,
        agreedRate: nextRate,
        insurance: nextInsurance,
        additionalCosts,
        courtesyAmount: Number(current.courtesy_amount ?? 0),
      });
      const ivaTotals = computeOptionalIvaTotals({
        pretaxTotal: computed.total,
        applyIva: Boolean(current.apply_iva),
        taxRate: Number(current.tax_rate ?? 0.13),
      });
      row.subtotal = ivaTotals.pretaxTotal;
      row.tax_amount = ivaTotals.taxAmount;
      row.total = ivaTotals.total;
    } else {
      const total = formData.get("total");
      if (total) row.total = Number(total);
    }

    if (Object.keys(row).length === 0) {
      return actionError("No hay cambios para guardar.");
    }

    row.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("contracts")
      .update(row)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await syncReservationFromContract(supabase, {
      reservationId: current.reservation_id,
      startAt: nextStart,
      endAt: nextEnd,
      agreedRate: nextRate,
      deposit: nextDeposit,
      insurance: nextInsurance,
      total: (row.total as number | undefined) ?? current.total,
      additionalCosts: sumExtraLineItems(
        normalizeExtraLineItems(current.extra_line_items),
      ),
      extraLineItems: normalizeExtraLineItems(current.extra_line_items),
      courtesyAmount: Number(current.courtesy_amount ?? 0),
      courtesyDetail: current.courtesy_detail ?? null,
      vehicleId: current.vehicle_id,
    });

    await writeAuditLog({
      userId: user.id,
      action: "contract.update",
      entityType: "contract",
      entityId: id,
    });

    revalidatePath("/dashboard/contratos");
    revalidatePath(`/dashboard/contratos/${id}`);
    revalidatePath("/dashboard/reservas");
    revalidatePath(`/dashboard/reservas/${current.reservation_id}`);
    revalidatePath("/dashboard/calendario");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

/** Operator override: include or exclude pagaré page in the contract PDF. */
export async function setContractIncludePagare(
  contractId: string,
  include: boolean,
): Promise<ActionResult<{ includePagare: boolean }>> {
  try {
    const { user } = await assertPermission("contracts.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("contracts")
      .select("status")
      .eq("id", contractId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) throw mapPostgresError(existingError);
    if (!existing) return actionError("Contrato no encontrado.");

    const status = (existing as { status: ContractStatus }).status;
    if (status === "COMPLETED" || status === "CANCELLED") {
      return actionError(
        "No se puede cambiar el pagaré de un contrato completado o cancelado.",
      );
    }

    const { error } = await supabase
      .from("contracts")
      .update({
        include_pagare: include,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "contract.include_pagare",
      entityType: "contract",
      entityId: contractId,
      metadata: { includePagare: include },
    });

    revalidatePath("/dashboard/contratos");
    revalidatePath(`/dashboard/contratos/${contractId}`);
    revalidatePath(`/dashboard/contratos/${contractId}/pdf`);
    return actionSuccess({ includePagare: include });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

/** Optional IVA on contract PDF/total. Recalculates total from pretax base. */
export async function setContractApplyIva(
  contractId: string,
  applyIva: boolean,
  taxRatePercent = 13,
): Promise<
  ActionResult<{ applyIva: boolean; taxRate: number; taxAmount: number; total: number }>
> {
  try {
    const { user } = await assertPermission("contracts.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("contracts")
      .select(
        "status, agreed_rate, insurance, start_at, end_at, total, apply_iva, tax_rate, tax_amount, subtotal, extra_line_items, reservation_id, courtesy_amount",
      )
      .eq("id", contractId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) throw mapPostgresError(existingError);
    if (!existing) return actionError("Contrato no encontrado.");

    const row = existing as {
      status: ContractStatus;
      agreed_rate: number;
      insurance: number;
      start_at: string;
      end_at: string;
      total: number;
      apply_iva?: boolean;
      tax_rate?: number;
      tax_amount?: number;
      subtotal?: number | null;
      extra_line_items?: Array<{ label?: string; amount?: number }> | null;
      reservation_id: string;
      courtesy_amount?: number;
    };

    if (row.status === "COMPLETED" || row.status === "CANCELLED") {
      return actionError(
        "No se puede cambiar el IVA de un contrato completado o cancelado.",
      );
    }

    const taxRate =
      taxRatePercent > 1 ? taxRatePercent / 100 : Math.max(0, taxRatePercent);

    const manualSum = (row.extra_line_items ?? []).reduce((sum, item) => {
      const amount = Number(item?.amount ?? 0);
      const label = String(item?.label ?? "").trim();
      return sum + (label && amount > 0 ? amount : 0);
    }, 0);

    const days = rentalDaysBetween(row.start_at, row.end_at);
    const pretax = Math.max(
      0,
      Math.round(
        (Number(row.agreed_rate) * days +
          Number(row.insurance ?? 0) +
          manualSum -
          Number(row.courtesy_amount ?? 0)) *
          100,
      ) / 100,
    );

    const ivaTotals = computeOptionalIvaTotals({
      pretaxTotal: pretax,
      applyIva,
      taxRate,
    });

    const { error } = await supabase
      .from("contracts")
      .update({
        apply_iva: applyIva,
        tax_rate: ivaTotals.taxRate,
        tax_amount: ivaTotals.taxAmount,
        subtotal: ivaTotals.pretaxTotal,
        total: ivaTotals.total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await syncReservationFromContract(supabase, {
      reservationId: row.reservation_id,
      total: ivaTotals.total,
    });

    await writeAuditLog({
      userId: user.id,
      action: "contract.apply_iva",
      entityType: "contract",
      entityId: contractId,
      metadata: {
        applyIva,
        taxRate: ivaTotals.taxRate,
        taxAmount: ivaTotals.taxAmount,
        total: ivaTotals.total,
      },
    });

    revalidatePath("/dashboard/contratos");
    revalidatePath(`/dashboard/contratos/${contractId}`);
    revalidatePath(`/dashboard/contratos/${contractId}/pdf`);
    revalidatePath("/dashboard/reservas");
    revalidatePath(`/dashboard/reservas/${row.reservation_id}`);
    revalidatePath("/dashboard/calendario");
    return actionSuccess({
      applyIva,
      taxRate: ivaTotals.taxRate,
      taxAmount: ivaTotals.taxAmount,
      total: ivaTotals.total,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export type ContractExtraLineInput = ExtraLineItem;

/** Replace manual extras on a contract and recalculate total (+ optional IVA). */
export async function setContractExtraLineItems(
  contractId: string,
  lines: ContractExtraLineInput[],
): Promise<
  ActionResult<{
    extraLineItems: ExtraLineItem[];
    total: number;
    taxAmount: number;
  }>
> {
  try {
    const { user } = await assertPermission("contracts.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const cleaned = normalizeExtraLineItems(lines);

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("contracts")
      .select(
        "status, agreed_rate, insurance, start_at, end_at, apply_iva, tax_rate, reservation_id, courtesy_amount",
      )
      .eq("id", contractId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) throw mapPostgresError(existingError);
    if (!existing) return actionError("Contrato no encontrado.");

    const row = existing as {
      status: ContractStatus;
      agreed_rate: number;
      insurance: number;
      start_at: string;
      end_at: string;
      apply_iva?: boolean;
      tax_rate?: number;
      reservation_id: string;
      courtesy_amount?: number;
    };

    if (row.status === "COMPLETED" || row.status === "CANCELLED") {
      return actionError(
        "No se pueden editar extras de un contrato completado o cancelado.",
      );
    }

    const days = rentalDaysBetween(row.start_at, row.end_at);
    const rental = Number(row.agreed_rate) * days;
    const insurance = Number(row.insurance ?? 0);
    const manualSum = sumExtraLineItems(cleaned);
    const courtesyAmount = Number(row.courtesy_amount ?? 0);
    const pretaxBase = Math.max(
      0,
      Math.round((rental + insurance + manualSum - courtesyAmount) * 100) / 100,
    );

    const ivaTotals = computeOptionalIvaTotals({
      pretaxTotal: pretaxBase,
      applyIva: Boolean(row.apply_iva),
      taxRate: Number(row.tax_rate ?? 0.13),
    });

    const { error } = await supabase
      .from("contracts")
      .update({
        extra_line_items: cleaned,
        subtotal: ivaTotals.pretaxTotal,
        tax_amount: ivaTotals.taxAmount,
        total: ivaTotals.total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await syncReservationFromContract(supabase, {
      reservationId: row.reservation_id,
      total: ivaTotals.total,
      additionalCosts: manualSum,
      extraLineItems: cleaned,
    });

    await writeAuditLog({
      userId: user.id,
      action: "contract.extra_line_items",
      entityType: "contract",
      entityId: contractId,
      metadata: {
        count: cleaned.length,
        total: ivaTotals.total,
      },
    });

    revalidatePath("/dashboard/contratos");
    revalidatePath(`/dashboard/contratos/${contractId}`);
    revalidatePath(`/dashboard/contratos/${contractId}/pdf`);
    revalidatePath("/dashboard/reservas");
    revalidatePath(`/dashboard/reservas/${row.reservation_id}`);
    revalidatePath("/dashboard/calendario");
    return actionSuccess({
      extraLineItems: cleaned,
      total: ivaTotals.total,
      taxAmount: ivaTotals.taxAmount,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function cancelContract(
  id: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("contracts.cancel");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("contracts")
      .select("id, status, closed_at, reservation_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) throw mapPostgresError(existingError);
    if (!existing) return actionError("Contrato no encontrado.");

    const row = existing as {
      id: string;
      status: ContractStatus;
      closed_at: string | null;
      reservation_id: string;
    };

    if (row.status === "COMPLETED" || row.closed_at) {
      return actionError(
        "Este contrato ya está cerrado. No se puede anular; use el acta de cierre.",
      );
    }
    if (row.status === "CANCELLED") {
      return actionError("Este contrato ya está anulado.");
    }

    // If the vehicle was already delivered (CHECK_OUT), do not allow cancel.
    // Staff must use "Cerrar renta" (check-in + close) instead.
    const { data: checkOut } = await supabase
      .from("inspections")
      .select("id")
      .eq("reservation_id", row.reservation_id)
      .eq("type", "CHECK_OUT")
      .limit(1)
      .maybeSingle();

    if (checkOut) {
      return actionError(
        "Este contrato ya tiene entrega (CHECK_OUT). No lo anule: use «Cerrar renta» para devolver el vehículo, completar el contrato y generar el acta. Anular cancela el documento y bloquea el cierre.",
      );
    }

    const { error } = await supabase
      .from("contracts")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    // Keep the full contract record (terms, amounts, signatures).
    // Free the operational chain so the vehicle can be used again.
    const { data: reservation } = await supabase
      .from("reservations")
      .select("id, vehicle_id, status")
      .eq("id", row.reservation_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (reservation) {
      const reservationRow = reservation as {
        id: string;
        vehicle_id: string;
        status: string;
      };
      if (
        reservationRow.status === "CONFIRMED" ||
        reservationRow.status === "ACTIVE"
      ) {
        await supabase
          .from("reservations")
          .update({ status: "CANCELLED" })
          .eq("id", reservationRow.id)
          .is("deleted_at", null);
      }

      await supabase
        .from("vehicles")
        .update({ status: "AVAILABLE" })
        .eq("id", reservationRow.vehicle_id)
        .in("status", ["RESERVED", "RENTED"])
        .is("deleted_at", null);
    }

    await writeAuditLog({
      userId: user.id,
      action: "contract.cancel",
      entityType: "contract",
      entityId: id,
      metadata: { preservedRecord: true },
    });

    revalidatePath("/dashboard/contratos");
    revalidatePath(`/dashboard/contratos/${id}`);
    revalidatePath("/dashboard/reservas");
    revalidatePath("/dashboard/vehiculos");
    revalidatePath("/dashboard/calendario");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

function isMissingRelationOrColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = String(
    (error as { message?: string }).message ??
      (error as { details?: string }).details ??
      "",
  ).toLowerCase();
  return (
    (message.includes("column") &&
      (message.includes("does not exist") ||
        message.includes("schema cache"))) ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

export type ContractDeliveryProgress = {
  checkOutId: string | null;
  checkInId: string | null;
  checkOutChecklistCount: number;
  hasClientSignature: boolean;
  hasRepresentativeSignature: boolean;
  amountPaid: number;
  hasPdf: boolean;
};

export async function getContractDeliveryProgress(
  contractId: string,
): Promise<ActionResult<ContractDeliveryProgress>> {
  try {
    await assertPermission("contracts.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: contract, error } = await supabase
      .from("contracts")
      .select("id, reservation_id, amount_paid, pdf_path")
      .eq("id", contractId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!contract) return actionError("Contrato no encontrado.");

    const row = contract as {
      reservation_id: string;
      amount_paid?: number | null;
      pdf_path?: string | null;
    };

    const [{ data: signatures }, { data: inspections }] = await Promise.all([
      supabase
        .from("contract_signatures")
        .select("signer_type")
        .eq("contract_id", contractId),
      supabase
        .from("inspections")
        .select("id, type, inspection_checklist_items(id)")
        .eq("reservation_id", row.reservation_id),
    ]);

    const signerTypes = new Set(
      ((signatures ?? []) as Array<{ signer_type: string }>).map(
        (s) => s.signer_type,
      ),
    );

    type InspRow = {
      id: string;
      type: "CHECK_OUT" | "CHECK_IN";
      inspection_checklist_items?: Array<{ id: string }> | null;
    };

    const bundles = (inspections ?? []) as InspRow[];
    const checkOut = bundles.find((i) => i.type === "CHECK_OUT");
    const checkIn = bundles.find((i) => i.type === "CHECK_IN");

    return actionSuccess({
      checkOutId: checkOut?.id ?? null,
      checkInId: checkIn?.id ?? null,
      checkOutChecklistCount: checkOut?.inspection_checklist_items?.length ?? 0,
      hasClientSignature: signerTypes.has("CLIENT"),
      hasRepresentativeSignature: signerTypes.has("REPRESENTATIVE"),
      amountPaid: Number(row.amount_paid ?? 0),
      hasPdf: Boolean(row.pdf_path),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export type ContractCloseContext = {
  contract: ContractDetail;
  extraDayGraceHours: number;
  checkOut: {
    id: string;
    mileage: number | null;
    fuel_level: string | null;
    checklist: Array<{ item_name: string; status: string }>;
  } | null;
  checkIn: {
    id: string;
    mileage: number | null;
    fuel_level: string | null;
    checklist: Array<{ item_name: string; status: string }>;
    hasDashboardPhoto: boolean;
  } | null;
  accessoryComparison: Array<{
    itemName: string;
    checkOutStatus: string | null;
    checkInStatus: string | null;
    changed: boolean;
  }>;
};

export async function getContractCloseContext(
  contractId: string,
): Promise<ActionResult<ContractCloseContext>> {
  try {
    await assertPermission("contracts.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const detail = await getContract(contractId);
    if (!detail.success) return actionError(detail.error);

    const supabase = await createClient();
    let inspections: unknown[] | null = null;

    const withPhotos = await supabase
      .from("inspections")
      .select(
        "id, type, mileage, fuel_level, inspection_checklist_items(item_name, status), inspection_photos(category)",
      )
      .eq("reservation_id", detail.data.reservation_id)
      .order("inspection_date", { ascending: true });

    if (withPhotos.error) {
      const fallback = await supabase
        .from("inspections")
        .select(
          "id, type, mileage, fuel_level, inspection_checklist_items(item_name, status)",
        )
        .eq("reservation_id", detail.data.reservation_id)
        .order("inspection_date", { ascending: true });
      if (fallback.error) throw mapPostgresError(fallback.error);
      inspections = fallback.data;
    } else {
      inspections = withPhotos.data;
    }

    type InspBundle = {
      id: string;
      type: "CHECK_OUT" | "CHECK_IN";
      mileage: number | null;
      fuel_level: string | null;
      inspection_checklist_items:
        | Array<{ item_name: string; status: string }>
        | null;
      inspection_photos: Array<{ category: string }> | null;
    };

    const bundles = (inspections ?? []) as InspBundle[];
    const checkOutRow = bundles.find((i) => i.type === "CHECK_OUT");
    const checkInRow = bundles.find((i) => i.type === "CHECK_IN");

    const checkOut = checkOutRow
      ? {
          id: checkOutRow.id,
          mileage: checkOutRow.mileage,
          fuel_level: checkOutRow.fuel_level,
          checklist: checkOutRow.inspection_checklist_items ?? [],
        }
      : null;

    const checkIn = checkInRow
      ? {
          id: checkInRow.id,
          mileage: checkInRow.mileage,
          fuel_level: checkInRow.fuel_level,
          checklist: checkInRow.inspection_checklist_items ?? [],
          hasDashboardPhoto: (checkInRow.inspection_photos ?? []).some(
            (p) => p.category === "DASHBOARD",
          ),
        }
      : null;

    const outMap = new Map(
      (checkOut?.checklist ?? []).map((i) => [i.item_name, i.status]),
    );
    const inMap = new Map(
      (checkIn?.checklist ?? []).map((i) => [i.item_name, i.status]),
    );
    const names = new Set([...outMap.keys(), ...inMap.keys()]);

    const accessoryComparison = [...names].map((itemName) => {
      const checkOutStatus = outMap.get(itemName) ?? null;
      const checkInStatus = inMap.get(itemName) ?? null;
      return {
        itemName,
        checkOutStatus,
        checkInStatus,
        changed:
          checkOutStatus != null &&
          checkInStatus != null &&
          checkOutStatus !== checkInStatus,
      };
    });

    const { data: settingsRow } = await supabase
      .from("business_settings")
      .select("policies")
      .limit(1)
      .maybeSingle();
    const policies = (settingsRow as { policies?: Record<string, unknown> } | null)
      ?.policies;
    const extraDayGraceHours =
      typeof policies?.extraDayGraceHours === "number"
        ? policies.extraDayGraceHours
        : 2;

    return actionSuccess({
      contract: detail.data,
      extraDayGraceHours,
      checkOut,
      checkIn,
      accessoryComparison,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

const CLOSE_FUEL_LEVELS = new Set([
  "EMPTY",
  "ONE_EIGHTH",
  "QUARTER",
  "THREE_EIGHTHS",
  "HALF",
  "FIVE_EIGHTHS",
  "THREE_QUARTERS",
  "SEVEN_EIGHTHS",
  "FULL",
]);

async function ensureCheckInChecklist(
  supabase: SupabaseServer,
  checkInId: string,
): Promise<void> {
  const { data: existing, error } = await supabase
    .from("inspection_checklist_items")
    .select("id")
    .eq("inspection_id", checkInId)
    .limit(1);
  if (error) throw mapPostgresError(error);
  if (existing && existing.length > 0) return;

  const defaults =
    (await getDefaultChecklistFromCatalog()) ?? DEFAULT_CHECKLIST_ITEMS;
  const rows = defaults.map((item, index) => ({
    inspection_id: checkInId,
    item_name: item.label,
    status: item.status,
    sort_order: index,
  }));
  const { error: insertError } = await supabase
    .from("inspection_checklist_items")
    .insert(rows);
  if (insertError) throw mapPostgresError(insertError);
}

/**
 * Guarda km + combustible en la inspección de entrada desde el wizard de cierre
 * (sin salir de la pantalla). También siembra checklist si faltaba.
 */
export async function saveCloseCheckInVitals(
  contractId: string,
  input: { mileage: number; fuelLevel: string },
): Promise<
  ActionResult<{
    mileage: number;
    fuelLevel: string;
    checkInId: string;
    hasChecklist: boolean;
  }>
> {
  try {
    const { user } = await assertPermission("contracts.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const mileage = Number(input.mileage);
    if (!Number.isInteger(mileage) || mileage < 0 || mileage > 9_999_999) {
      return actionError("Kilometraje inválido.");
    }
    const fuelLevel = String(input.fuelLevel ?? "").trim();
    if (!CLOSE_FUEL_LEVELS.has(fuelLevel)) {
      return actionError("Seleccione el nivel de combustible.");
    }

    const supabase = await createClient();
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, reservation_id, vehicle_id, status, closed_at")
      .eq("id", contractId)
      .is("deleted_at", null)
      .maybeSingle();
    if (contractError) throw mapPostgresError(contractError);
    if (!contract) return actionError("Contrato no encontrado.");

    const row = contract as {
      reservation_id: string;
      vehicle_id: string;
      status: string;
      closed_at: string | null;
    };
    if (row.status === "CANCELLED" || row.closed_at) {
      return actionError("No se puede editar la inspección de un contrato cerrado o anulado.");
    }

    const { data: checkIn, error: checkInError } = await supabase
      .from("inspections")
      .select("id")
      .eq("reservation_id", row.reservation_id)
      .eq("type", "CHECK_IN")
      .order("inspection_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (checkInError) throw mapPostgresError(checkInError);
    if (!checkIn) {
      return actionError(
        "Primero cree la inspección de entrada (CHECK_IN) y luego registre km y combustible aquí.",
      );
    }

    const checkInId = (checkIn as { id: string }).id;
    const { error: updateError } = await supabase
      .from("inspections")
      .update({
        mileage,
        fuel_level: fuelLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", checkInId);
    if (updateError) throw mapPostgresError(updateError);

    await applyVehicleMileage(supabase, {
      vehicleId: row.vehicle_id,
      mileage,
      source: "CHECK_IN",
      userId: user.id,
      inspectionId: checkInId,
      contractId,
      notes: "Vitals de cierre (CHECK_IN)",
    });

    await ensureCheckInChecklist(supabase, checkInId);

    const { count } = await supabase
      .from("inspection_checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("inspection_id", checkInId);

    await writeAuditLog({
      userId: user.id,
      action: "contract.close_checkin_vitals",
      entityType: "inspection",
      entityId: checkInId,
      metadata: { contractId, mileage, fuelLevel },
    });

    revalidatePath(`/dashboard/contratos/${contractId}`);
    revalidatePath(`/dashboard/contratos/${contractId}/cerrar`);
    revalidatePath(`/dashboard/inspecciones/${checkInId}`);
    revalidatePath(`/dashboard/vehiculos/${row.vehicle_id}`);
    revalidatePath("/dashboard/vehiculos");
    revalidatePath("/dashboard/alertas");
    revalidatePath("/dashboard/calendario");

    return actionSuccess({
      mileage,
      fuelLevel,
      checkInId,
      hasChecklist: (count ?? 0) > 0,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function closeContract(
  contractId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("contracts.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) throw mapPostgresError(existingError);
    if (!existing) return actionError("Contrato no encontrado.");

    const contract = mapContractRow(existing as ContractRow);
    if (contract.status === "CANCELLED") {
      return actionError("No se puede cerrar un contrato cancelado.");
    }
    if (contract.closed_at) {
      return actionError("Este contrato ya está cerrado.");
    }

    const extraCharges = parseMoneyInput(
      formData.get("extraCharges"),
      contract.extra_charges ?? 0,
    );
    const damageCharges = parseMoneyInput(
      formData.get("damageCharges"),
      contract.damage_charges ?? 0,
    );
    const fuelCharges = parseMoneyInput(
      formData.get("fuelCharges"),
      contract.fuel_charges ?? 0,
    );
    const complementaryAmount = parseMoneyInput(
      formData.get("complementaryAmount"),
      contract.complementary_amount ?? 0,
    );
    const finalPayment = parseMoneyInput(formData.get("finalPayment"), 0);
    const deliveredByName =
      String(formData.get("deliveredByName") ?? "").trim() || null;
    const receivedByName =
      String(formData.get("receivedByName") ?? "").trim() || null;
    const notesExtra = String(formData.get("closeNotes") ?? "").trim();
    const courtesyHours = Math.max(
      0,
      Number(formData.get("courtesyHours") ?? 0) || 0,
    );
    const courtesyDays = Math.max(
      0,
      Number(formData.get("courtesyDays") ?? 0) || 0,
    );
    const canCourtesy = await canManageCourtesyDiscount(user.id);
    const priorCourtesy = Number(contract.courtesy_amount ?? 0);
    const courtesyAmount = canCourtesy
      ? parseMoneyInput(formData.get("courtesyAmount"), priorCourtesy)
      : priorCourtesy;
    const courtesyDetail = canCourtesy
      ? String(formData.get("courtesyDetail") ?? "").trim() ||
        contract.courtesy_detail ||
        null
      : contract.courtesy_detail ?? null;
    /** Only newly added courtesy at close reduces owed (create-time courtesy already in total). */
    const additionalCloseCourtesy = Math.max(0, courtesyAmount - priorCourtesy);
    const graceExtraDaysWaived = Math.max(
      0,
      Number(formData.get("graceExtraDaysWaived") ?? 0) || 0,
    );
    const actualReturnRaw = formData.get("actualReturnAt");

    const { data: checkInInspection } = await supabase
      .from("inspections")
      .select("id, inspection_date")
      .eq("reservation_id", contract.reservation_id)
      .eq("type", "CHECK_IN")
      .order("inspection_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!checkInInspection) {
      return actionError(
        "Debe registrar la inspección de entrada (CHECK_IN) antes de cerrar el contrato.",
      );
    }

    const checkInId = (checkInInspection as { id: string }).id;

    // Permite completar km/combustible desde el wizard de cierre (mismo envío).
    const vitalsMileageRaw = formData.get("checkInMileage");
    const vitalsFuelRaw = formData.get("checkInFuelLevel");
    if (
      vitalsMileageRaw != null &&
      String(vitalsMileageRaw).trim() !== "" &&
      vitalsFuelRaw != null &&
      String(vitalsFuelRaw).trim() !== ""
    ) {
      const vitalsMileage = Number(vitalsMileageRaw);
      const vitalsFuel = String(vitalsFuelRaw).trim();
      if (
        Number.isInteger(vitalsMileage) &&
        vitalsMileage >= 0 &&
        vitalsMileage <= 9_999_999 &&
        CLOSE_FUEL_LEVELS.has(vitalsFuel)
      ) {
        const { error: vitalsError } = await supabase
          .from("inspections")
          .update({
            mileage: vitalsMileage,
            fuel_level: vitalsFuel,
            updated_at: new Date().toISOString(),
          })
          .eq("id", checkInId);
        if (vitalsError) throw mapPostgresError(vitalsError);
      }
    }

    await ensureCheckInChecklist(supabase, checkInId);

    const [{ data: checkInDetail }, { data: checklistRows }] = await Promise.all([
      supabase
        .from("inspections")
        .select("id, mileage, fuel_level")
        .eq("id", checkInId)
        .maybeSingle(),
      supabase
        .from("inspection_checklist_items")
        .select("id")
        .eq("inspection_id", checkInId)
        .limit(1),
    ]);

    const checkInInfo = checkInDetail as {
      mileage: number | null;
      fuel_level: string | null;
    } | null;

    if (checkInInfo?.mileage == null || !checkInInfo.fuel_level) {
      return actionError(
        "Kilometraje y combustible son obligatorios. Vuelva al paso «Combustible y km», complete los datos (siguen editables) y cierre de nuevo. Puede usar Anterior o Salir si necesita salir.",
      );
    }
    if (!checklistRows || checklistRows.length === 0) {
      return actionError(
        "Complete el checklist de accesorios en la inspección de entrada antes de cerrar.",
      );
    }

    if (String(formData.get("confirmClose") ?? "") !== "true") {
      return actionError(
        "Debe confirmar explícitamente el cierre del contrato.",
      );
    }

    const conformitySignatureDataUrl = String(
      formData.get("conformitySignatureDataUrl") ?? "",
    ).trim();
    const conformitySignedBy =
      String(formData.get("conformitySignedBy") ?? "").trim() || "Cliente";
    const depositReturned =
      String(formData.get("depositReturned") ?? "") === "true";
    const chargeConcept =
      String(formData.get("chargeConcept") ?? "").trim() || null;

    const { data: existingConformity } = await supabase
      .from("contract_signatures")
      .select("id")
      .eq("contract_id", contractId)
      .eq("signer_type", "CLOSE_CONFORMITY")
      .maybeSingle();

    if (!existingConformity && !conformitySignatureDataUrl) {
      return actionError(
        "El cliente debe firmar la declaración de conformidad antes de cerrar.",
      );
    }

    if (conformitySignatureDataUrl) {
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(conformitySignatureDataUrl)) {
        return actionError("Formato de firma de conformidad inválido.");
      }
      const upload = await uploadSignatureImage(
        contractId,
        "CLOSE_CONFORMITY",
        conformitySignatureDataUrl,
      );
      const headerStore = await headers();
      const ipAddress =
        headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const userAgent = headerStore.get("user-agent");
      const { error: conformityError } = await (async () => {
        try {
          await saveContractSignature(supabase, {
            contractId,
            signerType: "CLOSE_CONFORMITY",
            signedByName: conformitySignedBy,
            signaturePath: upload.storagePath,
            signedByUserId: null,
            ipAddress,
            userAgent,
          });
          return { error: null };
        } catch (error) {
          return { error };
        }
      })();
      if (conformityError) throw conformityError;
    }

    const checkInDate = (checkInInspection as { inspection_date?: string })
      .inspection_date;

    const actualReturnAt =
      actualReturnRaw && String(actualReturnRaw).trim() !== ""
        ? normalizeFormDateTimeToIso(actualReturnRaw)
        : checkInDate ?? null;

    const owed = Math.max(
      0,
      Number(contract.total) +
        extraCharges +
        damageCharges +
        fuelCharges +
        complementaryAmount -
        additionalCloseCourtesy,
    );
    const amountPaid = Number(contract.amount_paid ?? 0) + finalPayment;
    const balanceDue = Math.max(0, owed - amountPaid);
    const paymentStatus =
      balanceDue <= 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "PENDING";

    const closedAt = new Date().toISOString();
    const closeMetaBits = [
      notesExtra,
      chargeConcept ? `Concepto cargo: ${chargeConcept}` : null,
      Number(contract.deposit ?? 0) > 0
        ? `Garantía: ${depositReturned ? "DEVUELTA" : "RETENIDA"}`
        : null,
    ].filter(Boolean);
    const closeBlock =
      closeMetaBits.length > 0 ? `[Cierre] ${closeMetaBits.join(" · ")}` : null;
    const mergedNotes =
      closeBlock && contract.notes
        ? `${contract.notes}\n\n${closeBlock}`
        : closeBlock
          ? closeBlock
          : contract.notes;

    const updateRow: Record<string, unknown> = {
      status: "COMPLETED",
      closed_at: closedAt,
      extra_charges: extraCharges,
      damage_charges: damageCharges,
      fuel_charges: fuelCharges,
      complementary_amount: complementaryAmount,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      payment_status: paymentStatus,
      notes: mergedNotes,
      delivered_by_name: deliveredByName ?? contract.delivered_by_name ?? null,
      received_by_name: receivedByName ?? contract.received_by_name ?? null,
      courtesy_hours: courtesyHours,
      courtesy_days: courtesyDays,
      courtesy_amount: courtesyAmount,
      courtesy_detail: courtesyDetail,
      grace_extra_days_waived: graceExtraDaysWaived,
      actual_return_at: actualReturnAt,
    };

    let { error: updateError } = await supabase
      .from("contracts")
      .update(updateRow)
      .eq("id", contractId)
      .is("deleted_at", null);

    if (updateError && isMissingRelationOrColumn(updateError)) {
      const fallback = {
        status: "COMPLETED" as const,
        notes: mergedNotes,
      };
      const retry = await supabase
        .from("contracts")
        .update(fallback)
        .eq("id", contractId)
        .is("deleted_at", null);
      updateError = retry.error;
    }

    if (updateError) throw mapPostgresError(updateError);

    const { data: checkIn } = await supabase
      .from("inspections")
      .select("id, mileage")
      .eq("reservation_id", contract.reservation_id)
      .eq("type", "CHECK_IN")
      .order("inspection_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const checkInRow = checkIn as { id: string; mileage: number | null } | null;
    const mileage = checkInRow?.mileage ?? null;

    const { error: vehicleError } = await supabase
      .from("vehicles")
      .update({ status: "AVAILABLE" })
      .eq("id", contract.vehicle_id);

    if (vehicleError && !isMissingRelationOrColumn(vehicleError)) {
      throw mapPostgresError(vehicleError);
    }

    if (mileage != null && mileage >= 0) {
      await applyVehicleMileage(supabase, {
        vehicleId: contract.vehicle_id,
        mileage,
        source: "CHECK_IN",
        userId: user.id,
        inspectionId: checkInRow?.id ?? null,
        contractId,
        notes: "Cierre de contrato",
      });
    }

    await syncReservationFromContract(supabase, {
      reservationId: contract.reservation_id,
      startAt: contract.start_at,
      endAt: actualReturnAt || contract.end_at,
      agreedRate: contract.agreed_rate,
      deposit: contract.deposit,
      insurance: contract.insurance,
      total: Number(contract.total),
      courtesyAmount,
      courtesyDetail,
      vehicleId: contract.vehicle_id,
      status: "COMPLETED",
    });

    await writeAuditLog({
      userId: user.id,
      action: "contract.close",
      entityType: "contract",
      entityId: contractId,
      metadata: {
        extraCharges,
        damageCharges,
        fuelCharges,
        complementaryAmount,
        finalPayment,
        balanceDue,
        paymentStatus,
        mileage,
      },
    });

    revalidatePath("/dashboard/contratos");
    revalidatePath(`/dashboard/contratos/${contractId}`);
    revalidatePath("/dashboard/vehiculos");
    revalidatePath(`/dashboard/vehiculos/${contract.vehicle_id}`);
    revalidatePath("/dashboard/alertas");
    revalidatePath("/dashboard/reservas");
    if (contract.reservation_id) {
      revalidatePath(`/dashboard/reservas/${contract.reservation_id}`);
    }
    revalidatePath("/dashboard/calendario");
    return actionSuccess({ id: contractId });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function signContract(
  contractId: string,
  formData: FormData,
): Promise<ActionResult<{ status: ContractStatus; warning?: string }>> {
  try {
    const { user } = await assertPermission("contracts.sign");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = contractSignSchema.safeParse({
      signerType: formData.get("signerType"),
      signedBy: formData.get("signedBy"),
      signatureDataUrl: formData.get("signatureDataUrl"),
      acceptedTerms: formData.get("acceptedTerms"),
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    if (
      parsed.data.signerType === "CLIENT" &&
      !parsed.data.acceptedTerms
    ) {
      return actionError(
        "Debe aceptar los términos y condiciones antes de firmar.",
      );
    }

    // CLOSE_CONFORMITY does not require T&C — only the reception declaration.

    const supabase = await createClient();
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("status")
      .eq("id", contractId)
      .is("deleted_at", null)
      .maybeSingle();

    if (contractError) throw mapPostgresError(contractError);
    if (!contract) return actionError("Contrato no encontrado.");

    const currentStatus = (contract as { status: ContractStatus }).status;
    if (currentStatus === "CANCELLED") {
      return actionError("Este contrato ya no admite firmas.");
    }
    if (
      currentStatus === "COMPLETED" &&
      parsed.data.signerType !== "CLOSE_CONFORMITY"
    ) {
      return actionError("Este contrato ya no admite firmas.");
    }

    if (parsed.data.signerType === "PAGARE") {
      const { data: clientSigRow } = await supabase
        .from("contract_signatures")
        .select("id")
        .eq("contract_id", contractId)
        .eq("signer_type", "CLIENT")
        .maybeSingle();
      if (!clientSigRow) {
        return actionError(
          "Primero firme el contrato (términos y condiciones). El pagaré es un documento aparte.",
        );
      }
    }

    const upload = await uploadSignatureImage(
      contractId,
      parsed.data.signerType,
      parsed.data.signatureDataUrl,
    );

    const headerStore = await headers();
    const ipAddress = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = headerStore.get("user-agent");

    await saveContractSignature(supabase, {
      contractId,
      signerType: parsed.data.signerType,
      signedByName: parsed.data.signedBy,
      signaturePath: upload.storagePath,
      signedByUserId:
        parsed.data.signerType === "REPRESENTATIVE" ? user.id : null,
      ipAddress,
      userAgent,
    });

    // Do not surface storage infra warnings (R2) to the operator UI.
    if (upload.warning) {
      console.warn("[signContract] storage warning:", upload.warning);
    }

    let warning: string | undefined;
    if (parsed.data.signerType === "CLIENT") {
      const operatorSignatureDataUrl = formData.get("operatorSignatureDataUrl");
      const repWarning = await ensureRepresentativeSignature(
        supabase,
        contractId,
        user.id,
        ipAddress,
        userAgent,
        typeof operatorSignatureDataUrl === "string"
          ? operatorSignatureDataUrl
          : null,
      );
      if (repWarning) warning = repWarning;
    }

    const { data: allSignatures } = await supabase
      .from("contract_signatures")
      .select("signer_type")
      .eq("contract_id", contractId);

    const signerTypes = new Set(
      ((allSignatures ?? []) as Array<{ signer_type: string }>).map(
        (s) => s.signer_type,
      ),
    );

    const hasClient = signerTypes.has("CLIENT");
    const hasRepresentative = signerTypes.has("REPRESENTATIVE");
    const newStatus =
      currentStatus === "COMPLETED" ||
      parsed.data.signerType === "CLOSE_CONFORMITY"
        ? currentStatus
        : nextStatusAfterSign(hasClient, hasRepresentative);

    if (newStatus !== currentStatus) {
      const { error: updateError } = await supabase
        .from("contracts")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contractId);

      if (updateError) throw mapPostgresError(updateError);
    } else {
      // Always bump updated_at so the PDF URL cache-busts after any signature.
      const { error: touchError } = await supabase
        .from("contracts")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", contractId);
      if (touchError) throw mapPostgresError(touchError);
    }

    await writeAuditLog({
      userId: user.id,
      action: "contract.sign",
      entityType: "contract",
      entityId: contractId,
      metadata: {
        signerType: parsed.data.signerType,
        usedStorage: upload.usedStorage,
      },
    });

    revalidatePath("/dashboard/contratos");
    revalidatePath(`/dashboard/contratos/${contractId}`);
    revalidatePath(`/dashboard/contratos/${contractId}/pdf`);
    revalidatePath(`/dashboard/contratos/${contractId}/acta-cierre/pdf`);
    return actionSuccess({
      status: newStatus,
      warning,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getContractPdfData(contractId: string) {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select(
      "*, customers(*), vehicles(brand, model, year, plate, category, vehicle_type_id, vehicle_types(slug, name))",
    )
    .eq("id", contractId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;

  const row = data as ContractRow & {
    customers: CustomerRow;
    vehicles: {
      brand: string;
      model: string;
      year: number;
      plate: string;
      category: string | null;
      vehicle_type_id: string | null;
      vehicle_types: { slug: string; name: string } | null;
    };
  };

  type DamageViewKey = "TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT";

  const [
    { data: settings },
    { data: signatures },
    { data: inspections, error: inspectionsError },
    { data: vehicleImages },
  ] = await Promise.all([
    supabase.from("business_settings").select("*").limit(1).maybeSingle(),
    supabase
      .from("contract_signatures")
      .select("*")
      .eq("contract_id", contractId),
    supabase
      .from("inspections")
      .select(
        "id, type, inspection_date, mileage, fuel_level, notes, handover_person_name, additional_driver_name, inspection_checklist_items(item_name, status), inspection_damage_marks(view, x, y, damage_type, description, severity, mark_number, path_points), inspection_photos(storage_path, category, caption)",
      )
      .eq("reservation_id", row.reservation_id)
      .order("inspection_date", { ascending: true }),
    supabase
      .from("vehicle_images")
      .select("url, view, is_primary, position")
      .eq("vehicle_id", row.vehicle_id)
      .order("position", { ascending: true }),
  ]);

  if (inspectionsError) {
    console.error(
      "[getContractPdfData] inspections query failed",
      inspectionsError.message,
    );
  }

  const mapped = mapContractRow(row);
  const customer = mapCustomerRow(row.customers);
  const sigRows = ((signatures ?? []) as ContractSignatureRow[]).map(
    mapContractSignatureRow,
  );

  const clientSig = sigRows.find((s) => s.signer_type === "CLIENT");
  const repSig = sigRows.find((s) => s.signer_type === "REPRESENTATIVE");
  const pagareSig = sigRows.find((s) => s.signer_type === "PAGARE");

  type InspectionBundle = {
    id: string;
    type: "CHECK_OUT" | "CHECK_IN";
    inspection_date?: string | null;
    mileage: number | null;
    fuel_level: string | null;
    notes?: string | null;
    handover_person_name?: string | null;
    additional_driver_name?: string | null;
    inspection_checklist_items:
      | Array<{ item_name: string; status: string }>
      | null;
    inspection_damage_marks:
      | Array<{
          view: DamageViewKey;
          x: number;
          y: number;
          damage_type: string;
          description?: string | null;
          severity?: string | null;
          mark_number?: number | null;
          path_points?: Array<{ x: number; y: number }> | null;
        }>
      | null;
  };

  const bundles = (inspections ?? []) as InspectionBundle[];
  const checkOut = bundles.find((i) => i.type === "CHECK_OUT");
  const checkIn = bundles.find((i) => i.type === "CHECK_IN");

  const catalogAccessories = await listAccessoryCatalog();
  const accessorySource =
    catalogAccessories.length > 0 ? catalogAccessories : OLDES_ACCESSORIES;

  const accessoryByKey = new Map<
    string,
    { key: string; label: string; checkOut: string; checkIn: string }
  >(
    accessorySource.map((item) => [
      item.key,
      { key: item.key, label: item.label, checkOut: "☐", checkIn: "☐" },
    ]),
  );
  const accessoryByLabel = new Map(
    accessorySource.map((item) => [item.label.toUpperCase(), item.key]),
  );

  function checklistStatusMark(status: string): string {
    if (status === "OK") return "SÍ";
    if (status === "MISSING") return "NO";
    if (status === "DAMAGED" || status === "NEEDS_ATTENTION") return "DAÑADO";
    if (status === "NOT_APPLICABLE") return "N/A";
    return "☐";
  }

  function applyChecklist(
    items: Array<{ item_name: string; status: string }> | null | undefined,
    side: "checkOut" | "checkIn",
  ) {
    for (const item of items ?? []) {
      const key =
        accessoryByLabel.get(item.item_name.trim().toUpperCase()) ??
        item.item_name;
      const current = accessoryByKey.get(key);
      const mark = checklistStatusMark(item.status);
      if (current) {
        current[side] = mark;
      } else {
        accessoryByKey.set(key, {
          key,
          label: item.item_name,
          checkOut: side === "checkOut" ? mark : "☐",
          checkIn: side === "checkIn" ? mark : "☐",
        });
      }
    }
  }

  applyChecklist(checkOut?.inspection_checklist_items, "checkOut");
  applyChecklist(checkIn?.inspection_checklist_items, "checkIn");

  const mapDamagePathPoints = (
    raw: Array<{ x: number; y: number }> | null | undefined,
  ) => {
    if (!Array.isArray(raw) || raw.length < 2) return undefined;
    const points = raw
      .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
      .filter(
        (p) =>
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          p.x >= 0 &&
          p.x <= 1 &&
          p.y >= 0 &&
          p.y <= 1,
      );
    return points.length >= 2 ? points : undefined;
  };

  const damageMarks = [
    ...(checkOut?.inspection_damage_marks ?? []).map((mark, index) => ({
      view: mark.view,
      x: Number(mark.x),
      y: Number(mark.y),
      symbol: damageSymbol(mark.damage_type),
      phase: "OUT" as const,
      damageType: mark.damage_type,
      description: mark.description ?? null,
      severity: mark.severity ?? "LOW",
      markNumber: Number(mark.mark_number ?? index + 1),
      pathPoints: mapDamagePathPoints(mark.path_points),
    })),
    ...(checkIn?.inspection_damage_marks ?? []).map((mark, index) => ({
      view: mark.view,
      x: Number(mark.x),
      y: Number(mark.y),
      symbol: damageSymbol(mark.damage_type),
      phase: "IN" as const,
      damageType: mark.damage_type,
      description: mark.description ?? null,
      severity: mark.severity ?? "LOW",
      markNumber: Number(mark.mark_number ?? index + 1),
      pathPoints: mapDamagePathPoints(mark.path_points),
    })),
  ];

  const viewPhotos: Partial<Record<DamageViewKey, string>> = {};
  let primaryPhotoUrl: string | null = null;
  for (const image of (vehicleImages ?? []) as Array<{
    url: string;
    view: DamageViewKey | null;
    is_primary: boolean;
    position: number;
  }>) {
    if (image.is_primary && !primaryPhotoUrl) primaryPhotoUrl = image.url;
    if (image.view && !viewPhotos[image.view]) {
      viewPhotos[image.view] = image.url;
    }
  }
  if (!primaryPhotoUrl && vehicleImages?.[0]) {
    primaryPhotoUrl = (vehicleImages[0] as { url: string }).url;
  }

  const annexPhotos: Array<{ url: string; label: string }> = [];
  const seenPaths = new Set<string>();
  for (const inspection of (inspections ?? []) as Array<{
    type?: "CHECK_OUT" | "CHECK_IN";
    inspection_photos?: Array<{
      storage_path: string | null;
      category?: string | null;
      caption?: string | null;
    }> | null;
  }>) {
    const phase =
      inspection.type === "CHECK_IN" ? "Entrada" : "Salida";
    for (const photo of inspection.inspection_photos ?? []) {
      if (!photo.storage_path || seenPaths.has(photo.storage_path)) continue;
      seenPaths.add(photo.storage_path);
      const resolved = await resolvePrivateFileUrl(photo.storage_path);
      if (!resolved) continue;
      const categoryLabel =
        PHOTO_CATEGORY_LABELS[photo.category ?? ""] ?? photo.category ?? "Foto";
      const caption = photo.caption?.trim();
      annexPhotos.push({
        url: resolved,
        label: caption
          ? `${phase} · ${categoryLabel} — ${caption}`
          : `${phase} · ${categoryLabel}`,
      });
    }
  }

  let operatorName: string | null = repSig?.signed_by_name ?? null;
  let operatorSignatureUrl: string | null = null;
  let clientSignatureUrl: string | null = null;
  let pagareSignatureUrl: string | null = null;

  if (clientSig?.signature_path) {
    clientSignatureUrl =
      (await resolvePrivateFileUrl(clientSig.signature_path)) ??
      clientSig.signature_path;
  }

  if (repSig?.signature_path) {
    operatorSignatureUrl =
      (await resolvePrivateFileUrl(repSig.signature_path)) ??
      repSig.signature_path;
  }

  if (pagareSig?.signature_path) {
    pagareSignatureUrl =
      (await resolvePrivateFileUrl(pagareSig.signature_path)) ??
      pagareSig.signature_path;
  }

  // Mi perfil: nombre + firma del operador actual para vista previa
  // y como respaldo si aún no hay firma de empresa en el contrato.
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (authUser) {
    const { data: operatorProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, signature_url")
      .eq("id", authUser.id)
      .maybeSingle();
    if (operatorProfile) {
      const op = operatorProfile as {
        first_name: string;
        last_name: string;
        signature_url?: string | null;
      };
      const profileName = `${op.first_name} ${op.last_name}`.trim();
      if (!operatorName && profileName) {
        operatorName = profileName;
      }
      // Contratos abiertos: si la firma de empresa es del usuario actual,
      // refrescar nombre desde Mi perfil (p. ej. corrigió Oldes → Jaime).
      if (
        profileName &&
        repSig?.signed_by_user_id === authUser.id &&
        row.status !== "COMPLETED" &&
        row.status !== "CANCELLED"
      ) {
        operatorName = profileName;
      }
      if (!operatorSignatureUrl && op.signature_url) {
        operatorSignatureUrl =
          (await resolvePrivateFileUrl(op.signature_url)) ?? op.signature_url;
      }
    }
  }

  const settingsRow = settings as {
    business_name?: string;
    legal_name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    whatsapp?: string | null;
  } | null;

  const fuelOut = checkOut?.fuel_level
    ? FUEL_LEVEL_LABELS[checkOut.fuel_level] ?? checkOut.fuel_level
    : null;
  const fuelIn = checkIn?.fuel_level
    ? FUEL_LEVEL_LABELS[checkIn.fuel_level] ?? checkIn.fuel_level
    : null;

  const { data: reservationRow } = await supabase
    .from("reservations")
    .select("quote_id")
    .eq("id", row.reservation_id)
    .maybeSingle();

  const quoteId = (reservationRow as { quote_id?: string | null } | null)
    ?.quote_id;
  let quoteLines: Array<{
    description?: string | null;
    amount?: number | null;
    item_type?: string | null;
  }> = [];
  let quoteTaxRate: number | null = null;
  if (quoteId) {
    const [{ data: quoteItems }, { data: quoteRow }] = await Promise.all([
      supabase
        .from("quote_items")
        .select("description, amount, item_type")
        .eq("quote_id", quoteId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("quotes")
        .select("tax_rate")
        .eq("id", quoteId)
        .maybeSingle(),
    ]);
    quoteLines = (quoteItems ?? []) as typeof quoteLines;
    const tr = (quoteRow as { tax_rate?: number | null } | null)?.tax_rate;
    if (tr != null && Number(tr) > 0) quoteTaxRate = Number(tr);
  }

  const rentalDays = rentalDaysBetween(mapped.start_at, mapped.end_at);
  const applyIva = Boolean(mapped.apply_iva);
  const taxRate =
    applyIva
      ? Number(mapped.tax_rate ?? quoteTaxRate ?? 0.13)
      : Number(mapped.tax_rate ?? 0.13);
  const billing = buildContractBillingBreakdown({
    rentalDays,
    dailyRate: mapped.agreed_rate,
    insurance: mapped.insurance,
    contractTotal: mapped.total,
    quoteLines,
    manualLines: mapped.extra_line_items ?? [],
    courtesyAmount: Number(mapped.courtesy_amount ?? 0),
    applyIva,
    taxRate,
    taxAmount: Number(mapped.tax_amount ?? 0),
  });

  const additionalDriverName =
    checkOut?.additional_driver_name?.trim() ||
    customer.additional_driver_name?.trim() ||
    null;

  const handoverPersonName =
    checkOut?.handover_person_name?.trim() ||
    customer.receiver_name?.trim() ||
    null;

  const contact = resolvePdfBusinessContact(settingsRow);

  return {
    businessName: contact.businessName,
    legalName: contact.legalName,
    businessAddress: contact.businessAddress,
    businessPhone: contact.businessPhone,
    businessEmail: contact.businessEmail,
    businessWhatsapp: contact.businessWhatsapp,
    businessWebsite: contact.businessWebsite,
    contractCode: row.code,
    customerName: `${customer.first_name} ${customer.last_name}`,
    billingName:
      customer.customer_type === "COMPANY" && customer.company_name
        ? customer.company_name
        : `${customer.first_name} ${customer.last_name}`,
    customerType: customer.customer_type,
    companyName: customer.company_name,
    customerNit: customer.nit,
    customerNrc: customer.nrc,
    customerAddress: customer.address,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    customerIdentification: customer.identification,
    customerDui: customer.dui,
    customerPassport: customer.passport,
    driverName: `${customer.first_name} ${customer.last_name}`,
    licenseNumber: customer.license_number,
    licenseExpiry: customer.license_expiry
      ? formatAppDate(customer.license_expiry)
      : null,
    additionalDriverName,
    handoverPersonName,
    receiverName: customer.receiver_name,
    vehicleBrand: row.vehicles.brand,
    vehicleModel: row.vehicles.model,
    vehicleYear: row.vehicles.year,
    plate: row.vehicles.plate,
    vehicleType:
      row.vehicles.vehicle_types?.name ??
      row.vehicles.category,
    vehicleTypeSlug: row.vehicles.vehicle_types?.slug ?? null,
    vehicleTypeName: row.vehicles.vehicle_types?.name ?? null,
    startDateLabel: formatAppDate(mapped.start_at),
    startTimeLabel: formatAppTime(mapped.start_at),
    endDateLabel: formatAppDate(mapped.end_at),
    endTimeLabel: formatAppTime(mapped.end_at),
    deliveryDateLabel: formatAppDate(
      checkOut?.inspection_date ?? mapped.start_at,
    ),
    deliveryTimeLabel: formatAppTime(
      checkOut?.inspection_date ?? mapped.start_at,
    ),
    rentalDays,
    dailyRate: mapped.agreed_rate,
    otherCharges: 0,
    billingLineItems: billing.extraLines,
    deposit: mapped.deposit,
    insurance: mapped.insurance,
    applyIva: billing.applyIva,
    taxRate: billing.taxRate,
    taxAmount: billing.taxAmount,
    pretaxTotal: billing.pretaxTotal,
    total: billing.total,
    totalInWords: amountToSpanishUsd(billing.total),
    fuelOutLabel: fuelOut,
    fuelInLabel: fuelIn,
    mileageOut: checkOut?.mileage ?? null,
    mileageIn: checkIn?.mileage ?? null,
    accessories: [...accessoryByKey.values()],
    damageMarks,
    viewPhotos,
    primaryPhotoUrl,
    observations: mergeObservationTexts(mapped.notes, checkOut?.notes),
    terms: mapped.terms,
    clauses: mapped.clauses || OLDES_CONTRACT_CLAUSES.join("\n\n"),
    notes: mergeObservationTexts(mapped.notes, checkOut?.notes),
    clientSignedAt: clientSig
      ? formatAppDateTime(clientSig.signed_at)
      : null,
    representativeSignedAt: repSig
      ? formatAppDateTime(repSig.signed_at)
      : null,
    operatorName,
    operatorSignatureUrl,
    clientSignatureUrl,
    includePagare: resolveIncludePagare(mapped.include_pagare, {
      country: customer.country,
      dui: customer.dui,
      passport: customer.passport,
    }),
    pagareAmount: deductibleForVehicleType(
      row.vehicles.vehicle_types?.slug ??
        row.vehicles.vehicle_types?.name ??
        row.vehicles.category,
    ),
    pagareAmountWords: amountToSpanishUsd(
      deductibleForVehicleType(
        row.vehicles.vehicle_types?.slug ??
          row.vehicles.vehicle_types?.name ??
          row.vehicles.category,
      ),
    ),
    pagareSignatureUrl,
    pagareSignedAt: pagareSig
      ? formatAppDateTime(pagareSig.signed_at)
      : null,
    annexPhotos,
    issuedPlace: "San Salvador",
    issuedDateLabel: `${formatAppDate(checkOut?.inspection_date ?? mapped.start_at)} - ${formatAppTime(checkOut?.inspection_date ?? mapped.start_at)}`,
  };
}

export async function getContractCloseActPdfData(contractId: string) {
  if (!isSupabaseConfigured()) return null;

  const detail = await getContract(contractId);
  if (!detail.success) return null;
  const contract = detail.data;

  const supabase = await createClient();

  let inspections: unknown[] | null = null;
  const withPhotos = await supabase
    .from("inspections")
    .select(
      "id, type, mileage, fuel_level, notes, inspection_checklist_items(item_name, status), inspection_damage_marks(view, damage_type)",
    )
    .eq("reservation_id", contract.reservation_id)
    .order("inspection_date", { ascending: true });
  if (withPhotos.error) {
    console.error("[getContractCloseActPdfData]", withPhotos.error.message);
    return null;
  }
  inspections = withPhotos.data;

  type InspBundle = {
    id: string;
    type: "CHECK_OUT" | "CHECK_IN";
    mileage: number | null;
    fuel_level: string | null;
    notes: string | null;
    inspection_checklist_items:
      | Array<{ item_name: string; status: string }>
      | null;
    inspection_damage_marks:
      | Array<{ view: string; damage_type: string }>
      | null;
  };
  const bundles = (inspections ?? []) as InspBundle[];
  const checkOut = bundles.find((i) => i.type === "CHECK_OUT") ?? null;
  const checkIn = bundles.find((i) => i.type === "CHECK_IN") ?? null;

  const outMap = new Map(
    (checkOut?.inspection_checklist_items ?? []).map((i) => [
      i.item_name,
      i.status,
    ]),
  );
  const inMap = new Map(
    (checkIn?.inspection_checklist_items ?? []).map((i) => [
      i.item_name,
      i.status,
    ]),
  );
  const names = new Set([...outMap.keys(), ...inMap.keys()]);
  const accessoryComparison = [...names].map((itemName) => {
    const checkOutStatus = outMap.get(itemName) ?? null;
    const checkInStatus = inMap.get(itemName) ?? null;
    return {
      itemName,
      checkOutStatus,
      checkInStatus,
      changed:
        checkOutStatus != null &&
        checkInStatus != null &&
        checkOutStatus !== checkInStatus,
    };
  });

  const { data: settings } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  const settingsRow = settings as {
    business_name?: string;
    legal_name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    whatsapp?: string | null;
  } | null;

  const contact = resolvePdfBusinessContact(settingsRow);

  let operatorSignatureUrl: string | null = null;
  let clientSignatureUrl: string | null = null;
  let operatorName: string | null = null;
  let clientSignedAt: string | null = null;

  const closeConformitySig = contract.signatures.find(
    (s) => s.signer_type === "CLOSE_CONFORMITY",
  );
  const repSig = contract.signatures.find(
    (s) => s.signer_type === "REPRESENTATIVE",
  );

  // Prefer end-of-rental conformity signature over opening CLIENT signature.
  const closeClientSig = closeConformitySig ?? null;
  if (closeClientSig?.signature_path) {
    clientSignatureUrl =
      (await resolvePrivateFileUrl(closeClientSig.signature_path)) ??
      closeClientSig.signature_path;
    clientSignedAt = formatAppDateTime(closeClientSig.signed_at);
  }
  if (repSig?.signature_path) {
    operatorSignatureUrl =
      (await resolvePrivateFileUrl(repSig.signature_path)) ??
      repSig.signature_path;
    operatorName = repSig.signed_by_name;
  }

  {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, signature_url")
        .eq("id", authUser.id)
        .maybeSingle();
      if (profile) {
        const op = profile as {
          first_name: string;
          last_name: string;
          signature_url?: string | null;
        };
        const profileName = `${op.first_name} ${op.last_name}`.trim();
        if (!operatorName && profileName) {
          operatorName = profileName;
        }
        if (
          profileName &&
          repSig?.signed_by_user_id === authUser.id &&
          contract.status !== "COMPLETED" &&
          contract.status !== "CANCELLED"
        ) {
          operatorName = profileName;
        }
        if (!operatorSignatureUrl && op.signature_url) {
          operatorSignatureUrl =
            (await resolvePrivateFileUrl(op.signature_url)) ?? op.signature_url;
        }
      }
    }
  }

  const { data: customerRow } = await supabase
    .from("customers")
    .select("phone, email, identification, dui, passport")
    .eq("id", contract.customer_id)
    .maybeSingle();
  const customer = customerRow as {
    phone?: string | null;
    email?: string | null;
    identification?: string | null;
    dui?: string | null;
    passport?: string | null;
  } | null;

  const fuelOut = checkOut?.fuel_level
    ? FUEL_LEVEL_LABELS[checkOut.fuel_level] ?? checkOut.fuel_level
    : null;
  const fuelIn = checkIn?.fuel_level
    ? FUEL_LEVEL_LABELS[checkIn.fuel_level] ?? checkIn.fuel_level
    : null;

  function checklistStatusLabel(status: string | null): string {
    if (!status) return "—";
    if (status === "OK") return "SÍ";
    if (status === "MISSING") return "NO";
    if (status === "DAMAGED" || status === "NEEDS_ATTENTION") return "DAÑADO";
    if (status === "NOT_APPLICABLE") return "N/A";
    return status;
  }

  const accessories = accessoryComparison.map((row) => {
    const status = row.checkInStatus ?? row.checkOutStatus;
    const returned = Boolean(
      row.checkInStatus &&
        row.checkInStatus !== "MISSING" &&
        row.checkInStatus !== "NOT_APPLICABLE",
    );
    return {
      label: row.itemName,
      returned,
      statusLabel: checklistStatusLabel(status),
    };
  });

  const missingAccessories = accessoryComparison
    .filter(
      (row) =>
        row.checkInStatus === "MISSING" ||
        row.checkInStatus === "DAMAGED" ||
        row.checkInStatus === "NEEDS_ATTENTION" ||
        (row.changed &&
          row.checkOutStatus === "OK" &&
          row.checkInStatus !== "OK"),
    )
    .map(
      (row) =>
        `${row.itemName}: ${checklistStatusLabel(row.checkOutStatus)} → ${checklistStatusLabel(row.checkInStatus)}`,
    );

  const accessoryChanges = accessoryComparison
    .filter((row) => row.changed)
    .map(
      (row) =>
        `${row.itemName}: ${row.checkOutStatus ?? "—"} → ${row.checkInStatus ?? "—"}`,
    );

  const checkInDamageNotes = (checkIn?.inspection_damage_marks ?? []).map(
    (mark) =>
      `${damageSymbol(mark.damage_type)} ${DAMAGE_TYPE_LABELS[mark.damage_type] ?? mark.damage_type} (${mark.view})`,
  );

  const bodyZoneMarks: Partial<
    Record<"front" | "left" | "right" | "top" | "rear" | "glass", string>
  > = {};
  for (const mark of checkIn?.inspection_damage_marks ?? []) {
    const view = String(mark.view || "").toUpperCase();
    const key =
      view === "FRONT"
        ? "front"
        : view === "LEFT"
          ? "left"
          : view === "RIGHT"
            ? "right"
            : view === "TOP"
              ? "top"
              : view === "REAR"
                ? "rear"
                : null;
    if (!key) continue;
    const symbol = damageSymbol(mark.damage_type);
    bodyZoneMarks[key] = bodyZoneMarks[key]
      ? `${bodyZoneMarks[key]} ${symbol}`
      : symbol;
  }

  const newDamageNotes =
    [...checkInDamageNotes, ...accessoryChanges].join("; ") ||
    checkIn?.notes?.trim() ||
    null;

  const extraCharges = Number(contract.extra_charges ?? 0);
  const damageCharges = Number(contract.damage_charges ?? 0);
  const fuelCharges = Number(contract.fuel_charges ?? 0);
  const complementaryAmount = Number(contract.complementary_amount ?? 0);
  const totalOwed =
    Number(contract.total) +
    extraCharges +
    damageCharges +
    fuelCharges +
    complementaryAmount;
  const amountPaid = Number(contract.amount_paid ?? 0);
  const balanceDue =
    contract.balance_due != null
      ? Number(contract.balance_due)
      : Math.max(0, totalOwed - amountPaid);

  const notesText = contract.notes ?? "";
  const depositReturned =
    /Garantía:\s*DEVUELTA/i.test(notesText) ||
    (!/Garantía:\s*RETENIDA/i.test(notesText) &&
      balanceDue <= 0 &&
      Number(contract.deposit ?? 0) > 0 &&
      Boolean(contract.closed_at));
  const chargeConceptMatch = notesText.match(
    /Concepto cargo:\s*([^·\n]+)/i,
  );
  const chargeConcept =
    chargeConceptMatch?.[1]?.trim() ||
    [
      extraCharges > 0 ? "Días / cargos extra" : null,
      damageCharges > 0 ? "Daños" : null,
      fuelCharges > 0 ? "Combustible" : null,
      complementaryAmount > 0 ? "Complementario" : null,
    ]
      .filter(Boolean)
      .join("; ") ||
    null;

  const chargeLines = [
    extraCharges > 0
      ? { label: "Días extra / cargos extra", amount: extraCharges }
      : null,
    damageCharges > 0 ? { label: "Daños", amount: damageCharges } : null,
    fuelCharges > 0 ? { label: "Combustible", amount: fuelCharges } : null,
    complementaryAmount > 0
      ? { label: "Complementario", amount: complementaryAmount }
      : null,
  ].filter(Boolean) as Array<{ label: string; amount: number }>;

  const receiptCode = contract.code.replace(/^CTR/i, "REC");
  const actualReturn =
    contract.actual_return_at || contract.closed_at || contract.end_at;

  return {
    businessName: contact.businessName,
    legalName: contact.legalName,
    businessAddress: contact.businessAddress,
    businessPhone: contact.businessPhone,
    businessEmail: contact.businessEmail,
    receiptCode,
    issuedDateLabel: formatAppDate(
      contract.closed_at || new Date().toISOString(),
    ),
    contractCode: contract.code,
    customerName: contract.customerName,
    customerPhone: customer?.phone ?? null,
    customerEmail: customer?.email ?? null,
    customerIdentification:
      customer?.dui ||
      customer?.passport ||
      customer?.identification ||
      null,
    vehicleLabel: contract.vehicleLabel,
    plate: contract.plate,
    scheduledEndLabel: `${formatAppDate(contract.end_at)} · ${formatAppTime(contract.end_at)}`,
    actualReturnLabel: `${formatAppDate(actualReturn)} · ${formatAppTime(actualReturn)}`,
    returnPlace: contact.businessAddress,
    mileageOut: checkOut?.mileage ?? null,
    mileageIn: checkIn?.mileage ?? null,
    fuelOutLabel: fuelOut,
    fuelInLabel: fuelIn,
    fuelSameLevel:
      fuelOut && fuelIn ? fuelOut === fuelIn : fuelOut || fuelIn ? false : null,
    accessories,
    missingAccessories,
    noNewDamage: !newDamageNotes,
    newDamageNotes,
    bodyZoneMarks,
    extraCharges,
    damageCharges,
    fuelCharges,
    complementaryAmount,
    deposit: Number(contract.deposit ?? 0),
    depositReturned,
    chargeConcept,
    chargeLines,
    amountPaid,
    balanceDue,
    totalOwed,
    observations: contract.notes,
    operatorName,
    deliveredByName: contract.delivered_by_name ?? null,
    receivedByName: contract.received_by_name ?? null,
    operatorSignatureUrl,
    clientSignatureUrl,
    clientSignedAt,
    closedAtLabel: contract.closed_at
      ? formatAppDateTime(contract.closed_at)
      : null,
    verificationId: `#${receiptCode}`,
  };
}
