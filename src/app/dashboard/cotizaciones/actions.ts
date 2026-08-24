"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import {
  calculateQuoteLineTotals,
  calculateQuoteTotals,
} from "@/lib/calculations/quote";
import {
  mapQuoteRow,
  type QuoteRow,
} from "@/lib/db/mappers";
import { formatAppDate, formatAppDateTime, normalizeFormDateTimeToIso } from "@/lib/dates";
import { getCustomerDisplayName } from "@/lib/customers";
import { sendEmail } from "@/lib/email/resend";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { formatMoney, multiply, toNumber } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  buildQuoteWhatsAppMessage,
  buildWaMeLink,
} from "@/lib/whatsapp";
import {
  quoteSchema,
  quoteSearchSchema,
  quoteStatusSchema,
  type QuoteLineInput,
} from "@/lib/validation/quote";
import { createReservationFromQuote } from "@/app/dashboard/reservas/actions";
import type { Quote } from "@/types/database";
import type { PaginatedResult } from "@/types/api";

function parseLinesFromForm(formData: FormData): QuoteLineInput[] | undefined {
  const raw = formData.get("lines");
  if (raw == null || raw === "") return undefined;
  if (typeof raw !== "string") return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed as QuoteLineInput[];
  } catch {
    return undefined;
  }
}

function vehicleLabelFromJoin(
  vehicles:
    | { brand: string; model: string; year: number; plate?: string | null }
    | null
    | undefined,
): string {
  if (!vehicles) return "Sin unidad asignada";
  const plate = vehicles.plate ? ` · ${vehicles.plate}` : "";
  return `${vehicles.brand} ${vehicles.model} ${vehicles.year}${plate}`;
}

export type QuoteListItem = Quote & {
  customerName: string;
};

export async function listQuotes(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<QuoteListItem>>> {
  try {
    await assertPermission("quotes.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = quoteSearchSchema.parse({
      query: params.q,
      status: params.status,
      customerId: params.customerId,
      vehicleId: params.vehicleId,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();
    let query = supabase
      .from("quotes")
      .select(
        "*, customers(first_name, last_name, company_name, customer_type)",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.customerId) query = query.eq("customer_id", filters.customerId);
    if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
    if (filters.query) {
      const term = filters.query.trim();
      const { data: matchingCustomers } = await supabase
        .from("customers")
        .select("id")
        .is("deleted_at", null)
        .or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,company_name.ilike.%${term}%`,
        );

      const customerIds = (matchingCustomers ?? []).map(
        (row) => (row as { id: string }).id,
      );

      if (customerIds.length > 0) {
        query = query.or(
          `code.ilike.%${term}%,customer_id.in.(${customerIds.join(",")})`,
        );
      } else {
        query = query.ilike("code", `%${term}%`);
      }
    }

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    type QuoteWithCustomer = QuoteRow & {
      customers:
        | {
            first_name: string;
            last_name: string;
            company_name: string | null;
            customer_type: string | null;
          }
        | Array<{
            first_name: string;
            last_name: string;
            company_name: string | null;
            customer_type: string | null;
          }>
        | null;
    };

    const items = ((data ?? []) as QuoteWithCustomer[]).map((row) => {
      const customer = Array.isArray(row.customers)
        ? row.customers[0]
        : row.customers;
      const quote = mapQuoteRow(row);
      return {
        ...quote,
        customerName: customer
          ? getCustomerDisplayName({
              customer_type:
                (customer.customer_type as "PERSON" | "COMPANY" | null) ??
                "PERSON",
              first_name: customer.first_name,
              last_name: customer.last_name,
              company_name: customer.company_name,
            })
          : "—",
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

export async function getQuote(id: string): Promise<ActionResult<Quote>> {
  try {
    await assertPermission("quotes.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Cotización no encontrada.");

    return actionSuccess(mapQuoteRow(data as QuoteRow));
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createQuote(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("quotes.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const vehicleRaw = formData.get("vehicleId");
    const linesRaw = parseLinesFromForm(formData);

    const parsed = quoteSchema.safeParse({
      customerId: formData.get("customerId"),
      vehicleId:
        vehicleRaw && String(vehicleRaw).trim() ? vehicleRaw : undefined,
      webRequestId: formData.get("webRequestId") || undefined,
      startAt: normalizeFormDateTimeToIso(formData.get("startAt")),
      endAt: normalizeFormDateTimeToIso(formData.get("endAt")),
      dailyRate: formData.get("dailyRate") || 0,
      insuranceAmount: formData.get("insuranceAmount") || 0,
      depositAmount: formData.get("depositAmount") || 0,
      deliveryFee: formData.get("deliveryFee") || 0,
      pickupFee: formData.get("pickupFee") || 0,
      discountAmount: formData.get("discountAmount") || 0,
      discountPercent: formData.get("discountPercent") || 0,
      otherCharges: formData.get("otherCharges") || 0,
      taxRate: formData.get("taxRate") || 0,
      language: formData.get("language") || "en",
      notes: formData.get("notes"),
      terms: formData.get("terms"),
      validUntil: formData.get("validUntil")
        ? normalizeFormDateTimeToIso(formData.get("validUntil"))
        : undefined,
      status: formData.get("status") || "DRAFT",
      lines: linesRaw,
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const lines = parsed.data.lines ?? [];
    const useLines = lines.length > 0;

    const totals = useLines
      ? calculateQuoteLineTotals({
          startAt: parsed.data.startAt,
          endAt: parsed.data.endAt,
          lines,
          discountPercent: parsed.data.discountPercent,
          taxRatePercent: parsed.data.taxRate,
          depositAmount: parsed.data.depositAmount,
        })
      : (() => {
          const discountFromPercent =
            parsed.data.discountPercent > 0
              ? undefined
              : parsed.data.discountAmount;
          const base = calculateQuoteTotals({
            ...parsed.data,
            discountAmount: discountFromPercent ?? 0,
          });
          if (parsed.data.discountPercent > 0) {
            const discountAmount = toNumber(
              multiply(base.subtotal, parsed.data.discountPercent / 100),
            );
            return calculateQuoteTotals({
              ...parsed.data,
              discountAmount,
            });
          }
          return base;
        })();

    const taxRateFraction = parsed.data.taxRate / 100;
    const dailyRate = useLines
      ? (lines.find((l) => l.item_type === "VEHICLE")?.unit_price ??
        lines[0]?.unit_price ??
        0)
      : parsed.data.dailyRate;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        customer_id: parsed.data.customerId,
        vehicle_id: parsed.data.vehicleId ?? null,
        web_request_id: parsed.data.webRequestId ?? null,
        language: parsed.data.language,
        start_at: parsed.data.startAt,
        end_at: parsed.data.endAt,
        days: totals.rentalDays,
        daily_rate: dailyRate,
        subtotal: totals.subtotal,
        insurance: useLines ? 0 : totals.insuranceAmount,
        deposit: totals.depositAmount,
        delivery_fee: useLines ? 0 : totals.deliveryFee,
        pickup_fee: useLines ? 0 : totals.pickupFee,
        discount: totals.discountAmount,
        discount_percent: parsed.data.discountPercent,
        other_charges: useLines ? 0 : totals.otherCharges,
        tax_rate: taxRateFraction,
        tax: totals.taxAmount,
        total: totals.total,
        notes: parsed.data.notes ?? null,
        terms: parsed.data.terms ?? null,
        valid_until: parsed.data.validUntil
          ? parsed.data.validUntil.slice(0, 10)
          : null,
        status: parsed.data.status,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;

    if (useLines) {
      const itemRows = lines.map((line, index) => {
        const amount =
          line.amount ??
          toNumber(multiply(line.quantity, line.unit_price));
        return {
          quote_id: id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          amount,
          sort_order: index,
          item_type: line.item_type ?? "CUSTOM",
          item_code: line.item_code ?? null,
          catalog_item_id: line.catalog_item_id ?? null,
          tax_rate: line.tax_rate ?? taxRateFraction,
        };
      });

      const { error: itemsError } = await supabase
        .from("quote_items")
        .insert(itemRows);

      if (itemsError) throw mapPostgresError(itemsError);
    }

    if (parsed.data.webRequestId) {
      await supabase
        .from("web_requests")
        .update({ status: "QUOTED" })
        .eq("id", parsed.data.webRequestId);
    }

    await writeAuditLog({
      userId: user.id,
      action: "quote.create",
      entityType: "quote",
      entityId: id,
    });

    revalidatePath("/dashboard/cotizaciones");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateQuoteStatus(
  id: string,
  status: Quote["status"],
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("quotes.edit");
    const parsed = quoteStatusSchema.safeParse({ status });
    if (!parsed.success) {
      return actionError("Estado inválido.");
    }

    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("quotes")
      .update({ status: parsed.data.status })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "quote.status_update",
      entityType: "quote",
      entityId: id,
      metadata: { status: parsed.data.status },
    });

    revalidatePath("/dashboard/cotizaciones");
    revalidatePath(`/dashboard/cotizaciones/${id}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

/** RN-03: accept quote only — never creates a reservation. */
export async function acceptQuote(
  quoteId: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("quotes.accept");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quotes")
      .update({ status: "ACCEPTED" })
      .eq("id", quoteId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Cotización no encontrada.");

    await writeAuditLog({
      userId: user.id,
      action: "quote.accept",
      entityType: "quote",
      entityId: quoteId,
    });

    revalidatePath("/dashboard/cotizaciones");
    revalidatePath(`/dashboard/cotizaciones/${quoteId}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

/**
 * @deprecated RN-03 — accepting a quote must not auto-create a reservation.
 * Prefer `acceptQuote` then create the reservation manually.
 */
export async function acceptQuoteAndCreateReservation(
  quoteId: string,
): Promise<ActionResult<{ reservationId: string }>> {
  try {
    await assertPermission("quotes.accept");
    const result = await createReservationFromQuote(quoteId);
    if (!result.success) {
      return actionError(result.error);
    }
    return actionSuccess({ reservationId: result.data.id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function sendQuoteEmail(
  quoteId: string,
): Promise<ActionResult<{ emailSent: boolean; message: string }>> {
  try {
    const { user } = await assertPermission("quotes.send");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: quote, error } = await supabase
      .from("quotes")
      .select(
        "*, customers(first_name, last_name, email, phone), vehicles(brand, model, year)",
      )
      .eq("id", quoteId)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!quote) return actionError("Cotización no encontrada.");

    const q = quote as QuoteRow & {
      customers: {
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string;
      };
      vehicles: { brand: string; model: string; year: number } | null;
    };

    if (!q.customers.email) {
      return actionError("El cliente no tiene correo registrado.");
    }

    const mapped = mapQuoteRow(q);
    const vehicleLabel = vehicleLabelFromJoin(q.vehicles);
    const emailResult = await sendEmail({
      to: q.customers.email,
      subject: `Cotización ${q.code}`,
      html: `<p>Estimado/a ${q.customers.first_name},</p>
        <p>Adjuntamos su cotización <strong>${q.code}</strong>.</p>
        <p>Vehículo: ${vehicleLabel}</p>
        <p>Total: ${formatMoney(mapped.total)}</p>
        <p>Periodo: ${formatAppDateTime(mapped.start_at)} – ${formatAppDateTime(mapped.end_at)}</p>`,
      text: `Cotización ${q.code}. Vehículo: ${vehicleLabel}. Total: ${formatMoney(mapped.total)}.`,
    });

    if (emailResult.ok) {
      await supabase
        .from("quotes")
        .update({ status: "SENT" })
        .eq("id", quoteId);

      await writeAuditLog({
        userId: user.id,
        action: "quote.send_email",
        entityType: "quote",
        entityId: quoteId,
      });

      revalidatePath(`/dashboard/cotizaciones/${quoteId}`);
      return actionSuccess({
        emailSent: true,
        message: "Correo enviado correctamente.",
      });
    }

    return actionSuccess({
      emailSent: false,
      message: emailResult.message,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getQuoteWhatsAppLink(
  quoteId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    await assertPermission("quotes.send");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: quote, error } = await supabase
      .from("quotes")
      .select(
        "code, total, customers(first_name, last_name, phone), vehicles(brand, model, year)",
      )
      .eq("id", quoteId)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!quote) return actionError("Cotización no encontrada.");

    const q = quote as unknown as {
      code: string;
      total: number;
      customers: { first_name: string; last_name: string; phone: string };
      vehicles: { brand: string; model: string; year: number } | null;
    };

    const message = buildQuoteWhatsAppMessage({
      customerName: `${q.customers.first_name} ${q.customers.last_name}`,
      quoteCode: q.code,
      vehicleLabel: vehicleLabelFromJoin(q.vehicles),
      totalLabel: formatMoney(q.total),
    });

    return actionSuccess({
      url: buildWaMeLink(q.customers.phone, message),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getQuotePdfData(quoteId: string) {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select(
      "*, customers(first_name, last_name, phone, email, company_name, customer_type), vehicles(brand, model, year, plate)",
    )
    .eq("id", quoteId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;

  const { data: settings } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  const { data: items } = await supabase
    .from("quote_items")
    .select("description, quantity, unit_price, amount, sort_order")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: true });

  const q = data as QuoteRow & {
    customers: {
      first_name: string;
      last_name: string;
      phone: string | null;
      email: string | null;
      company_name?: string | null;
      customer_type?: string | null;
    };
    vehicles: {
      brand: string;
      model: string;
      year: number;
      plate: string | null;
    } | null;
    welcome_text?: string | null;
    payment_conditions?: string | null;
    delivery_instructions?: string | null;
    insurance_policy_text?: string | null;
    driving_guidelines?: string | null;
  };

  const mapped = mapQuoteRow(q);
  const settingsRow = settings as {
    business_name?: string;
    address?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
  } | null;

  const customerName =
    q.customers.customer_type === "COMPANY" && q.customers.company_name
      ? q.customers.company_name
      : `${q.customers.first_name} ${q.customers.last_name}`;

  const lineItems = (items ?? []).map((item) => ({
    description: String(item.description ?? ""),
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unit_price ?? 0),
    amount: Number(item.amount ?? 0),
  }));

  return {
    businessName:
      settingsRow?.business_name ?? "OLDES Rent a Car El Salvador",
    businessAddress: settingsRow?.address ?? null,
    businessPhone: settingsRow?.phone ?? "+503 7435-0381",
    businessEmail: settingsRow?.email ?? null,
    businessWhatsapp: settingsRow?.whatsapp ?? "+503 7435-0381",
    quoteCode: q.code,
    issuedAtLabel: formatAppDate(mapped.created_at),
    language: mapped.language === "es" ? ("es" as const) : ("en" as const),
    customerName,
    customerPhone: q.customers.phone,
    customerEmail: q.customers.email,
    vehicleLabel: vehicleLabelFromJoin(q.vehicles),
    startAtLabel: formatAppDateTime(mapped.start_at),
    endAtLabel: formatAppDateTime(mapped.end_at),
    rentalDays: mapped.rental_days,
    dailyRate: mapped.daily_rate,
    subtotal: mapped.subtotal,
    insuranceAmount: mapped.insurance_amount,
    depositAmount: mapped.deposit_amount,
    deliveryFee: mapped.delivery_fee,
    pickupFee: mapped.pickup_fee,
    discountAmount: mapped.discount_amount,
    otherCharges: mapped.other_charges,
    taxAmount: mapped.tax_amount,
    total: mapped.total,
    lineItems,
    welcomeText: q.welcome_text ?? null,
    paymentConditions: q.payment_conditions ?? null,
    deliveryInstructions: q.delivery_instructions ?? null,
    insurancePolicyText: q.insurance_policy_text ?? null,
    drivingGuidelines: q.driving_guidelines ?? null,
    notes: mapped.notes,
    terms: mapped.terms,
    validUntilLabel: mapped.valid_until
      ? formatAppDate(mapped.valid_until)
      : null,
  };
}
