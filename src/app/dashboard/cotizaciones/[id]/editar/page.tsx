import { notFound } from "next/navigation";

import { getQuoteForEdit } from "@/app/dashboard/cotizaciones/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import {
  QuoteForm,
  type QuoteCatalogItem,
  type QuoteVehicleTypeOption,
} from "@/components/forms/quote-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { toDatetimeLocalValue } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  mapCustomerRow,
  type CustomerRow,
} from "@/lib/db/mappers";

export default async function EditarCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();

  if (!configured) {
    return (
      <PermissionGuard permission="quotes.edit">
        <SetupBanner />
      </PermissionGuard>
    );
  }

  const quoteResult = await getQuoteForEdit(id);
  if (!quoteResult.success) notFound();
  const quote = quoteResult.data;

  const supabase = await createClient();
  const [
    { data: customerRows },
    { data: typeRows },
    catalogResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .is("deleted_at", null)
      .order("last_name"),
    supabase
      .from("vehicle_types")
      .select(
        "id, name, name_en, description, description_en, reference_models, reference_models_en, daily_rate",
      )
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("quote_catalog_items")
      .select(
        "id, name_es, name_en, description_es, description_en, unit_price, tax_rate, item_type",
      )
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const customers = ((customerRows ?? []) as CustomerRow[]).map((row) => {
    const c = mapCustomerRow(row);
    return { id: c.id, label: `${c.first_name} ${c.last_name}` };
  });

  const vehicleTypes: QuoteVehicleTypeOption[] = (
    (typeRows ?? []) as Array<{
      id: string;
      name: string;
      name_en: string | null;
      description: string | null;
      description_en: string | null;
      reference_models: string | null;
      reference_models_en: string | null;
      daily_rate: number;
    }>
  ).map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    description: row.description,
    descriptionEn: row.description_en,
    referenceModels: row.reference_models,
    referenceModelsEn: row.reference_models_en,
    dailyRate: Number(row.daily_rate),
  }));

  let catalogItems: QuoteCatalogItem[] = [];
  if (!catalogResult.error && catalogResult.data) {
    catalogItems = (
      catalogResult.data as Array<{
        id: string;
        name_es: string;
        name_en: string;
        description_es: string | null;
        description_en: string | null;
        unit_price: number;
        tax_rate: number;
        item_type: string;
      }>
    ).map((row) => ({
      id: row.id,
      name_es: row.name_es,
      name_en: row.name_en,
      description_es: row.description_es,
      description_en: row.description_en,
      unit_price: Number(row.unit_price),
      tax_rate: Number(row.tax_rate),
      item_type: row.item_type,
    }));
  }

  const lines = quote.items.map((item, index) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    item_type: (["VEHICLE", "SERVICE", "TAX", "DISCOUNT", "CUSTOM"].includes(
      item.item_type,
    )
      ? item.item_type
      : "CUSTOM") as
      | "VEHICLE"
      | "SERVICE"
      | "TAX"
      | "DISCOUNT"
      | "CUSTOM",
    catalog_item_id: item.catalog_item_id,
    item_code: item.item_code,
    tax_rate: item.tax_rate,
    from_vehicle_type:
      item.item_type === "VEHICLE" &&
      Boolean(quote.vehicle_type_id) &&
      index === quote.items.findIndex((i) => i.item_type === "VEHICLE"),
  }));

  return (
    <PermissionGuard permission="quotes.delete">
      <div className="space-y-6">
        <PageHeader
          title={`Editar ${quote.code}`}
          breadcrumbs={[
            { label: "Cotizaciones", href: "/dashboard/cotizaciones" },
            { label: quote.code, href: `/dashboard/cotizaciones/${id}` },
            { label: "Editar" },
          ]}
        />
        <QuoteForm
          mode="edit"
          quoteId={id}
          customers={customers}
          vehicleTypes={vehicleTypes}
          catalogItems={catalogItems}
          defaults={{
            customerId: quote.customer_id,
            vehicleTypeId: quote.vehicle_type_id ?? undefined,
            startAt: toDatetimeLocalValue(quote.start_at),
            endAt: toDatetimeLocalValue(quote.end_at),
            depositAmount: quote.deposit_amount,
            taxRate: Number((quote.tax_rate * 100).toFixed(2)),
            discountPercent: quote.discount_percent,
            notes: quote.notes ?? undefined,
            terms: quote.terms ?? undefined,
            validUntil: quote.valid_until
              ? toDatetimeLocalValue(
                  quote.valid_until.includes("T")
                    ? quote.valid_until
                    : `${quote.valid_until}T12:00:00.000Z`,
                )
              : undefined,
            language: quote.language,
            lines,
          }}
        />
      </div>
    </PermissionGuard>
  );
}
