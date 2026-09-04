"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import {
  mapQuoteRow,
  mapReservationRow,
  type QuoteRow,
  type ReservationRow,
} from "@/lib/db/mappers";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { calculateReservationTotal } from "@/lib/calculations/quote";
import { normalizeFormDateTimeToIso } from "@/lib/dates";
import { getCustomerDisplayName } from "@/lib/customers";
import { parseMoneyInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  reservationCancelSchema,
  reservationSchema,
  reservationSearchSchema,
  reservationUpdateSchema,
} from "@/lib/validation/reservation";
import type { Reservation } from "@/types/database";
import type { PaginatedResult } from "@/types/api";

export async function listReservations(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<ReservationListItem>>> {
  try {
    await assertPermission("reservations.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = reservationSearchSchema.parse({
      query: params.q,
      status: params.status,
      vehicleId: params.vehicleId,
      customerId: params.customerId,
      from: params.from,
      to: params.to,
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
      .from("reservations")
      .select(
        "*, customers(first_name, last_name, company_name, customer_type), vehicles(brand, model, plate)",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order("start_at", { ascending: true });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
    if (filters.customerId) query = query.eq("customer_id", filters.customerId);
    if (filters.from) query = query.gte("start_at", filters.from);
    if (filters.to) query = query.lte("end_at", filters.to);
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

    type Row = ReservationRow & {
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
        | { brand: string | null; model: string | null; plate: string | null }
        | Array<{ brand: string | null; model: string | null; plate: string | null }>
        | null;
    };

    const items = ((data ?? []) as Row[]).map((row) => {
      const customer = Array.isArray(row.customers)
        ? row.customers[0]
        : row.customers;
      const vehicle = Array.isArray(row.vehicles)
        ? row.vehicles[0]
        : row.vehicles;
      const reservation = mapReservationRow(row);
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
      const vehicleLabel =
        [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ").trim() ||
        vehicle?.plate?.trim() ||
        "—";

      return {
        ...reservation,
        customerName,
        vehicleLabel,
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

export type ReservationListItem = Reservation & {
  customerName: string;
  vehicleLabel: string;
};

export async function getReservation(
  id: string,
): Promise<ActionResult<Reservation>> {
  try {
    await assertPermission("reservations.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Reserva no encontrada.");

    return actionSuccess(mapReservationRow(data as ReservationRow));
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createReservation(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("reservations.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const startAt = normalizeFormDateTimeToIso(formData.get("startAt"));
    const endAt = normalizeFormDateTimeToIso(formData.get("endAt"));
    const agreedRate = parseMoneyInput(formData.get("agreedRate"));
    const deposit = parseMoneyInput(formData.get("deposit"));
    const insurance = parseMoneyInput(formData.get("insurance"));
    const cashAmount = parseMoneyInput(formData.get("cashAmount") || 0);
    const cardAmount = parseMoneyInput(formData.get("cardAmount") || 0);
    const additionalCosts = parseMoneyInput(
      formData.get("additionalCosts") || 0,
    );
    const computed = calculateReservationTotal({
      startAt,
      endAt,
      agreedRate,
      insurance,
    });

    const parsed = reservationSchema.safeParse({
      customerId: formData.get("customerId"),
      vehicleId: formData.get("vehicleId"),
      quoteId: formData.get("quoteId") || undefined,
      startAt,
      endAt,
      pickupLocation: formData.get("pickupLocation"),
      returnLocation: formData.get("returnLocation"),
      vehicleType: formData.get("vehicleType"),
      agreedRate,
      deposit,
      insurance,
      total: computed.total,
      cashAmount,
      cardAmount,
      additionalCosts,
      notes: formData.get("notes"),
      status: formData.get("status") || "CONFIRMED",
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .insert({
        customer_id: parsed.data.customerId,
        vehicle_id: parsed.data.vehicleId,
        quote_id: parsed.data.quoteId ?? null,
        start_at: parsed.data.startAt,
        end_at: parsed.data.endAt,
        pickup_location: parsed.data.pickupLocation ?? null,
        return_location: parsed.data.returnLocation ?? null,
        vehicle_type: parsed.data.vehicleType ?? null,
        agreed_rate: parsed.data.agreedRate,
        deposit: parsed.data.deposit,
        insurance: parsed.data.insurance,
        total: parsed.data.total,
        cash_amount: parsed.data.cashAmount,
        card_amount: parsed.data.cardAmount,
        additional_costs: parsed.data.additionalCosts,
        notes: parsed.data.notes ?? null,
        status: parsed.data.status,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;

    if (parsed.data.quoteId) {
      await supabase
        .from("quotes")
        .update({ status: "ACCEPTED" })
        .eq("id", parsed.data.quoteId);

      const { data: quote } = await supabase
        .from("quotes")
        .select("web_request_id")
        .eq("id", parsed.data.quoteId)
        .maybeSingle();

      if ((quote as { web_request_id: string | null } | null)?.web_request_id) {
        await supabase
          .from("web_requests")
          .update({ status: "CONVERTED" })
          .eq(
            "id",
            (quote as { web_request_id: string }).web_request_id,
          );
      }
    }

    await writeAuditLog({
      userId: user.id,
      action: "reservation.create",
      entityType: "reservation",
      entityId: id,
    });

    revalidatePath("/dashboard/reservas");
    revalidatePath("/dashboard/calendario");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createReservationFromQuote(
  quoteId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("reservations.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .is("deleted_at", null)
      .maybeSingle();

    if (quoteError) throw mapPostgresError(quoteError);
    if (!quote) return actionError("Cotización no encontrada.");

    const q = mapQuoteRow(quote as QuoteRow);
    if (!q.vehicle_id) {
      return actionError(
        "La cotización no tiene unidad asignada. Cree la reserva manualmente y elija el vehículo.",
      );
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        customer_id: q.customer_id,
        vehicle_id: q.vehicle_id,
        quote_id: quoteId,
        start_at: q.start_at,
        end_at: q.end_at,
        agreed_rate: q.daily_rate,
        deposit: q.deposit_amount,
        insurance: q.insurance_amount,
        total: q.total,
        cash_amount: q.total,
        card_amount: 0,
        additional_costs: 0,
        status: "CONFIRMED",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;

    await supabase
      .from("quotes")
      .update({ status: "ACCEPTED" })
      .eq("id", quoteId);

    if (q.web_request_id) {
      await supabase
        .from("web_requests")
        .update({ status: "CONVERTED" })
        .eq("id", q.web_request_id);
    }

    await writeAuditLog({
      userId: user.id,
      action: "reservation.create_from_quote",
      entityType: "reservation",
      entityId: id,
      metadata: { quoteId },
    });

    revalidatePath("/dashboard/reservas");
    revalidatePath("/dashboard/cotizaciones");
    revalidatePath("/dashboard/calendario");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateReservation(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("reservations.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const startAtRaw = formData.get("startAt");
    const endAtRaw = formData.get("endAt");
    const startAt = startAtRaw
      ? normalizeFormDateTimeToIso(startAtRaw)
      : undefined;
    const endAt = endAtRaw ? normalizeFormDateTimeToIso(endAtRaw) : undefined;
    const agreedRateRaw = formData.get("agreedRate");
    const insuranceRaw = formData.get("insurance");
    const depositRaw = formData.get("deposit");
    const cashAmountRaw = formData.get("cashAmount");
    const cardAmountRaw = formData.get("cardAmount");
    const additionalCostsRaw = formData.get("additionalCosts");

    const parsed = reservationUpdateSchema.safeParse({
      customerId: formData.get("customerId") || undefined,
      vehicleId: formData.get("vehicleId") || undefined,
      startAt,
      endAt,
      pickupLocation: formData.get("pickupLocation"),
      returnLocation: formData.get("returnLocation"),
      vehicleType: formData.get("vehicleType"),
      agreedRate:
        agreedRateRaw !== null && agreedRateRaw !== ""
          ? parseMoneyInput(agreedRateRaw)
          : undefined,
      deposit:
        depositRaw !== null && depositRaw !== ""
          ? parseMoneyInput(depositRaw)
          : undefined,
      insurance:
        insuranceRaw !== null && insuranceRaw !== ""
          ? parseMoneyInput(insuranceRaw)
          : undefined,
      cashAmount:
        cashAmountRaw !== null && cashAmountRaw !== ""
          ? parseMoneyInput(cashAmountRaw)
          : undefined,
      cardAmount:
        cardAmountRaw !== null && cardAmountRaw !== ""
          ? parseMoneyInput(cardAmountRaw)
          : undefined,
      additionalCosts:
        additionalCostsRaw !== null && additionalCostsRaw !== ""
          ? parseMoneyInput(additionalCostsRaw)
          : undefined,
      notes: formData.get("notes"),
      status: formData.get("status") || undefined,
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const row: Record<string, unknown> = {};
    if (parsed.data.customerId) row.customer_id = parsed.data.customerId;
    if (parsed.data.vehicleId) row.vehicle_id = parsed.data.vehicleId;
    if (parsed.data.startAt) row.start_at = parsed.data.startAt;
    if (parsed.data.endAt) row.end_at = parsed.data.endAt;
    if (parsed.data.pickupLocation !== undefined)
      row.pickup_location = parsed.data.pickupLocation ?? null;
    if (parsed.data.returnLocation !== undefined)
      row.return_location = parsed.data.returnLocation ?? null;
    if (parsed.data.vehicleType !== undefined)
      row.vehicle_type = parsed.data.vehicleType ?? null;
    if (parsed.data.agreedRate !== undefined)
      row.agreed_rate = parsed.data.agreedRate;
    if (parsed.data.deposit !== undefined) row.deposit = parsed.data.deposit;
    if (parsed.data.insurance !== undefined)
      row.insurance = parsed.data.insurance;
    if (parsed.data.cashAmount !== undefined)
      row.cash_amount = parsed.data.cashAmount;
    if (parsed.data.cardAmount !== undefined)
      row.card_amount = parsed.data.cardAmount;
    if (parsed.data.additionalCosts !== undefined)
      row.additional_costs = parsed.data.additionalCosts;
    if (parsed.data.notes !== undefined) row.notes = parsed.data.notes ?? null;
    if (parsed.data.status) row.status = parsed.data.status;

    // Recalculate total on server when pricing inputs change.
    if (
      parsed.data.startAt ||
      parsed.data.endAt ||
      parsed.data.agreedRate !== undefined ||
      parsed.data.insurance !== undefined
    ) {
      const supabaseForRead = await createClient();
      const { data: current, error: currentError } = await supabaseForRead
        .from("reservations")
        .select("start_at, end_at, agreed_rate, insurance")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (currentError) throw mapPostgresError(currentError);
      if (!current) return actionError("Reserva no encontrada.");

      const currentRow = current as {
        start_at: string;
        end_at: string;
        agreed_rate: number;
        insurance: number;
      };

      const computed = calculateReservationTotal({
        startAt: parsed.data.startAt ?? currentRow.start_at,
        endAt: parsed.data.endAt ?? currentRow.end_at,
        agreedRate:
          parsed.data.agreedRate !== undefined
            ? parsed.data.agreedRate
            : currentRow.agreed_rate,
        insurance:
          parsed.data.insurance !== undefined
            ? parsed.data.insurance
            : currentRow.insurance,
      });
      row.total = computed.total;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("reservations")
      .update(row)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "reservation.update",
      entityType: "reservation",
      entityId: id,
    });

    revalidatePath("/dashboard/reservas");
    revalidatePath(`/dashboard/reservas/${id}`);
    revalidatePath("/dashboard/calendario");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function cancelReservation(
  id: string,
  formData: FormData,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("reservations.cancel");
    const parsed = reservationCancelSchema.safeParse({
      reason: formData.get("reason"),
    });

    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();

    const { data: activeContract } = await supabase
      .from("contracts")
      .select("id, code, status")
      .eq("reservation_id", id)
      .neq("status", "CANCELLED")
      .is("deleted_at", null)
      .maybeSingle();

    if (activeContract) {
      const code = (activeContract as { code: string }).code;
      return actionError(
        `No se puede cancelar: existe el contrato ${code}. Cancele el contrato primero.`,
      );
    }

    const { error } = await supabase
      .from("reservations")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "reservation.cancel",
      entityType: "reservation",
      entityId: id,
      metadata: { reason: parsed.success ? parsed.data.reason : undefined },
    });

    revalidatePath("/dashboard/reservas");
    revalidatePath(`/dashboard/reservas/${id}`);
    revalidatePath("/dashboard/calendario");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export type CalendarReservationRow = {
  id: string;
  code: string;
  status: string;
  start_at: string;
  end_at: string;
  vehicle_id: string;
  vehicleLabel: string;
  customerName: string;
};

export async function listReservationsForCalendar(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<CalendarReservationRow[]>> {
  try {
    await assertPermission("reservations.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    let query = supabase
      .from("reservations")
      .select(
        "id, code, status, start_at, end_at, vehicle_id, customers(first_name, last_name), vehicles(brand, model, plate)",
      )
      .is("deleted_at", null)
      .order("start_at", { ascending: true });

    if (params.vehicleId) {
      query = query.eq("vehicle_id", String(params.vehicleId));
    }
    if (params.status) {
      query = query.eq("status", String(params.status));
    }

    const { data, error } = await query.limit(200);
    if (error) throw mapPostgresError(error);

    const items = (data ?? []).map((row) => {
      const r = row as {
        id: string;
        code: string;
        status: string;
        start_at: string;
        end_at: string;
        vehicle_id: string;
        customers:
          | { first_name: string | null; last_name: string | null }
          | Array<{ first_name: string | null; last_name: string | null }>
          | null;
        vehicles:
          | { brand: string | null; model: string | null; plate: string | null }
          | Array<{ brand: string | null; model: string | null; plate: string | null }>
          | null;
      };
      const customer = Array.isArray(r.customers) ? r.customers[0] : r.customers;
      const vehicle = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
      const vehicleLabel =
        vehicle?.model?.trim() ||
        [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ").trim() ||
        vehicle?.plate?.trim() ||
        "Vehículo";
      const customerName =
        `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() ||
        "Cliente";

      return {
        id: r.id,
        code: r.code,
        status: r.status,
        start_at: r.start_at,
        end_at: r.end_at,
        vehicle_id: r.vehicle_id,
        vehicleLabel,
        customerName,
      };
    });

    return actionSuccess(items);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
