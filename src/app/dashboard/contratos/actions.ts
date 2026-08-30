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
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { calculateReservationTotal } from "@/lib/calculations/quote";
import {
  OLDES_ACCESSORIES,
  OLDES_CONTRACT_CLAUSES,
  amountToSpanishUsd,
  damageSymbol,
} from "@/lib/contracts/oldes-terms";
import { listAccessoryCatalog } from "@/lib/inspections/accessory-catalog";
import { FUEL_LEVEL_LABELS, PHOTO_CATEGORY_LABELS } from "@/lib/inspections/defaults";
import { buildDeliverySteps } from "@/lib/contracts/delivery-steps";
import { resolveBodyStyle } from "@/lib/inspections/vehicle-panel-map";
import { parseMoneyInput } from "@/lib/money";
import { resolvePrivateFileUrl, uploadSignatureImage } from "@/lib/storage/private-upload";
import { createClient } from "@/lib/supabase/server";
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
};

function nextStatusAfterSign(
  hasClient: boolean,
  hasRepresentative: boolean,
): ContractStatus {
  if (hasClient) return "COMPLETED";
  if (hasRepresentative) return "REPRESENTATIVE_SIGNED";
  return "PENDING";
}

async function ensureRepresentativeSignature(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contractId: string,
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
) {
  const { data: existing } = await supabase
    .from("contract_signatures")
    .select("id")
    .eq("contract_id", contractId)
    .eq("signer_type", "REPRESENTATIVE")
    .maybeSingle();

  if (existing) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, signature_url")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return;

  const operator = profile as {
    first_name: string;
    last_name: string;
    signature_url?: string | null;
  };
  const operatorName = `${operator.first_name} ${operator.last_name}`.trim();
  if (!operatorName) return;

  let signaturePath: string | null = null;
  if (operator.signature_url?.startsWith("data:")) {
    const upload = await uploadSignatureImage(
      contractId,
      "REPRESENTATIVE",
      operator.signature_url,
    );
    signaturePath = upload.storagePath;
  } else if (operator.signature_url) {
    signaturePath = operator.signature_url;
  }

  await supabase.from("contract_signatures").insert({
    contract_id: contractId,
    signer_type: "REPRESENTATIVE",
    signed_by_name: operatorName,
    signed_by_user_id: userId,
    signature_path: signaturePath,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
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
    const vehicleLabel = `${vehicles.brand} ${vehicles.model} ${vehicles.year} (${vehicles.plate})`;

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
): Promise<ActionResult<PaginatedResult<Contract>>> {
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
    let query = supabase
      .from("contracts")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.customerId) query = query.eq("customer_id", filters.customerId);
    if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
    if (filters.query) query = query.ilike("code", `%${filters.query}%`);

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    return actionSuccess({
      items: ((data ?? []) as ContractRow[]).map(mapContractRow),
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
        "*, customers(first_name, last_name), vehicles(brand, model, year, plate), reservations(code)",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Contrato no encontrado.");

    const row = data as ContractRow & {
      customers:
        | { first_name: string; last_name: string }
        | Array<{ first_name: string; last_name: string }>;
      vehicles:
        | { brand: string; model: string; year: number; plate: string }
        | Array<{ brand: string; model: string; year: number; plate: string }>;
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

    const contract = mapContractRow(row);

    return actionSuccess({
      ...contract,
      signatures: ((signatures ?? []) as ContractSignatureRow[]).map(
        mapContractSignatureRow,
      ),
      customerName: `${customers.first_name} ${customers.last_name}`,
      vehicleLabel: `${vehicles.brand} ${vehicles.model} ${vehicles.year}`,
      plate: vehicles.plate,
      reservationCode: reservations.code,
    });
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
    const computed = calculateReservationTotal({
      startAt,
      endAt,
      agreedRate,
      insurance,
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
        total: computed.total,
        terms: parsed.data.terms ?? null,
        clauses: parsed.data.clauses ?? null,
        notes: parsed.data.notes ?? null,
        status: parsed.data.status,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;

    await writeAuditLog({
      userId: user.id,
      action: "contract.create",
      entityType: "contract",
      entityId: id,
      metadata: { reservationId: parsed.data.reservationId },
    });

    revalidatePath("/dashboard/contratos");
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
      .select("status")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) throw mapPostgresError(existingError);
    if (!existing) return actionError("Contrato no encontrado.");

    const status = (existing as { status: ContractStatus }).status;
    if (status === "COMPLETED" || status === "CANCELLED") {
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
    const total = formData.get("total");
    const startAt = formData.get("startAt");
    const endAt = formData.get("endAt");

    if (agreedRate) row.agreed_rate = Number(agreedRate);
    if (deposit) row.deposit = Number(deposit);
    if (insurance) row.insurance = Number(insurance);
    if (total) row.total = Number(total);
    if (startAt) row.start_at = normalizeFormDateTimeToIso(startAt);
    if (endAt) row.end_at = normalizeFormDateTimeToIso(endAt);

    const { error } = await supabase
      .from("contracts")
      .update(row)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "contract.update",
      entityType: "contract",
      entityId: id,
    });

    revalidatePath("/dashboard/contratos");
    revalidatePath(`/dashboard/contratos/${id}`);
    return actionSuccess({ id });
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
    const { error } = await supabase
      .from("contracts")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "contract.cancel",
      entityType: "contract",
      entityId: id,
    });

    revalidatePath("/dashboard/contratos");
    revalidatePath(`/dashboard/contratos/${id}`);
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

    const checkInDate = (checkInInspection as { inspection_date?: string })
      .inspection_date;

    const actualReturnAt =
      actualReturnRaw && String(actualReturnRaw).trim() !== ""
        ? normalizeFormDateTimeToIso(actualReturnRaw)
        : checkInDate ?? null;

    const owed =
      Number(contract.total) +
      extraCharges +
      damageCharges +
      fuelCharges +
      complementaryAmount;
    const amountPaid = Number(contract.amount_paid ?? 0) + finalPayment;
    const balanceDue = Math.max(0, owed - amountPaid);
    const paymentStatus =
      balanceDue <= 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "PENDING";

    const closedAt = new Date().toISOString();
    const mergedNotes =
      notesExtra && contract.notes
        ? `${contract.notes}\n\n[Cierre] ${notesExtra}`
        : notesExtra
          ? `[Cierre] ${notesExtra}`
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

    const vehicleUpdate: Record<string, unknown> = { status: "AVAILABLE" };
    if (mileage != null && mileage >= 0) {
      vehicleUpdate.current_mileage = mileage;
    }

    const { error: vehicleError } = await supabase
      .from("vehicles")
      .update(vehicleUpdate)
      .eq("id", contract.vehicle_id);

    if (vehicleError && !isMissingRelationOrColumn(vehicleError)) {
      console.error("[closeContract] vehicle update", vehicleError.message);
    }

    if (mileage != null && mileage >= 0) {
      try {
        const { error: historyError } = await supabase
          .from("vehicle_mileage_history")
          .insert({
            vehicle_id: contract.vehicle_id,
            mileage,
            source: "CHECK_IN",
            inspection_id: checkInRow?.id ?? null,
            contract_id: contractId,
            notes: "Cierre de contrato",
            created_by: user.id,
          });
        if (historyError && !isMissingRelationOrColumn(historyError)) {
          console.error(
            "[closeContract] mileage history",
            historyError.message,
          );
        }
      } catch {
        // Table may not exist yet — ignore.
      }
    }

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
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

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
    if (currentStatus === "CANCELLED" || currentStatus === "COMPLETED") {
      return actionError("Este contrato ya no admite firmas.");
    }

    const upload = await uploadSignatureImage(
      contractId,
      parsed.data.signerType,
      parsed.data.signatureDataUrl,
    );

    const headerStore = await headers();
    const ipAddress = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = headerStore.get("user-agent");

    const { error: sigError } = await supabase.from("contract_signatures").upsert(
      {
        contract_id: contractId,
        signer_type: parsed.data.signerType,
        signed_by_name: parsed.data.signedBy,
        signed_by_user_id:
          parsed.data.signerType === "REPRESENTATIVE" ? user.id : null,
        signature_path: upload.storagePath,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
      { onConflict: "contract_id,signer_type" },
    );

    if (sigError) throw mapPostgresError(sigError);

    if (parsed.data.signerType === "CLIENT") {
      await ensureRepresentativeSignature(
        supabase,
        contractId,
        user.id,
        ipAddress,
        userAgent,
      );
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
    const newStatus = nextStatusAfterSign(hasClient, hasRepresentative);

    const { error: updateError } = await supabase
      .from("contracts")
      .update({ status: newStatus })
      .eq("id", contractId);

    if (updateError) throw mapPostgresError(updateError);

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
    return actionSuccess({
      status: newStatus,
      warning: upload.warning,
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
      "*, customers(*), vehicles(brand, model, year, plate, category)",
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
        "id, type, mileage, fuel_level, inspection_checklist_items(item_name, status), inspection_damage_marks(view, x, y, damage_type), inspection_photos(storage_path, category, caption)",
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

  type InspectionBundle = {
    id: string;
    type: "CHECK_OUT" | "CHECK_IN";
    mileage: number | null;
    fuel_level: string | null;
    inspection_checklist_items:
      | Array<{ item_name: string; status: string }>
      | null;
    inspection_damage_marks:
      | Array<{
          view: DamageViewKey;
          x: number;
          y: number;
          damage_type: string;
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
    if (status === "OK") return "✓";
    if (status === "MISSING") return "X";
    if (status === "DAMAGED" || status === "NEEDS_ATTENTION") return "○";
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

  const damageMarks = [
    ...(checkOut?.inspection_damage_marks ?? []).map((mark) => ({
      view: mark.view,
      x: Number(mark.x),
      y: Number(mark.y),
      symbol: damageSymbol(mark.damage_type),
      phase: "OUT" as const,
    })),
    ...(checkIn?.inspection_damage_marks ?? []).map((mark) => ({
      view: mark.view,
      x: Number(mark.x),
      y: Number(mark.y),
      symbol: damageSymbol(mark.damage_type),
      phase: "IN" as const,
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
  if (repSig?.signature_path) {
    operatorSignatureUrl =
      (await resolvePrivateFileUrl(repSig.signature_path)) ??
      repSig.signature_path;
  }

  if (!operatorName) {
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
        operatorName = `${op.first_name} ${op.last_name}`.trim();
        if (!operatorSignatureUrl && op.signature_url) {
          operatorSignatureUrl =
            (await resolvePrivateFileUrl(op.signature_url)) ?? op.signature_url;
        }
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

  return {
    businessName: settingsRow?.business_name ?? "OLDES Renta Autos",
    legalName: settingsRow?.legal_name ?? null,
    businessAddress: settingsRow?.address ?? null,
    businessPhone: settingsRow?.phone ?? null,
    businessEmail: settingsRow?.email ?? null,
    businessWhatsapp: settingsRow?.whatsapp ?? null,
    contractCode: row.code,
    customerName: `${customer.first_name} ${customer.last_name}`,
    billingName: `${customer.first_name} ${customer.last_name}`,
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
    vehicleBrand: row.vehicles.brand,
    vehicleModel: row.vehicles.model,
    vehicleYear: row.vehicles.year,
    plate: row.vehicles.plate,
    vehicleType: row.vehicles.category,
    bodyStyle: resolveBodyStyle(row.vehicles.category, row.vehicles.model),
    startDateLabel: formatAppDate(mapped.start_at),
    startTimeLabel: formatAppTime(mapped.start_at),
    endDateLabel: formatAppDate(mapped.end_at),
    endTimeLabel: formatAppTime(mapped.end_at),
    rentalDays: rentalDaysBetween(mapped.start_at, mapped.end_at),
    dailyRate: mapped.agreed_rate,
    otherCharges: 0,
    deposit: mapped.deposit,
    insurance: mapped.insurance,
    total: mapped.total,
    totalInWords: amountToSpanishUsd(mapped.total),
    fuelOutLabel: fuelOut,
    fuelInLabel: fuelIn,
    mileageOut: checkOut?.mileage ?? null,
    mileageIn: checkIn?.mileage ?? null,
    accessories: [...accessoryByKey.values()],
    damageMarks,
    viewPhotos,
    primaryPhotoUrl,
    observations: mapped.notes,
    terms: mapped.terms,
    clauses: mapped.clauses || OLDES_CONTRACT_CLAUSES.join("\n"),
    notes: mapped.notes,
    clientSignedAt: clientSig
      ? formatAppDateTime(clientSig.signed_at)
      : null,
    representativeSignedAt: repSig
      ? formatAppDateTime(repSig.signed_at)
      : null,
    operatorName,
    operatorSignatureUrl,
    annexPhotos,
    issuedPlace: "San Salvador",
    issuedDateLabel: formatAppDate(mapped.created_at),
  };
}
