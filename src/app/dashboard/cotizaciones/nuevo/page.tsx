import { getWebRequest } from "@/app/dashboard/solicitudes/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import {
  QuoteForm,
  type QuoteCatalogItem,
  type QuoteVehicleTypeOption,
} from "@/components/forms/quote-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { appLocalDateTimeToUtc, toDatetimeLocalValue } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  mapCustomerRow,
  type CustomerRow,
} from "@/lib/db/mappers";

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();

  let customers: Array<{ id: string; label: string }> = [];
  let vehicleTypes: QuoteVehicleTypeOption[] = [];
  let catalogItems: QuoteCatalogItem[] = [];
  const defaults: {
    customerId?: string;
    vehicleTypeId?: string;
    webRequestId?: string;
    startAt?: string;
    endAt?: string;
    insuranceAmount?: number;
    depositAmount?: number;
    deliveryFee?: number;
    terms?: string;
    language?: "es" | "en";
  } = { language: "es" };

  if (configured) {
    const supabase = await createClient();
    const [
      { data: customerRows },
      { data: typeRows },
      { data: settingsRow },
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
      supabase.from("business_settings").select("*").limit(1).maybeSingle(),
      supabase
        .from("quote_catalog_items")
        .select(
          "id, name_es, name_en, description_es, description_en, unit_price, tax_rate, item_type",
        )
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    customers = ((customerRows ?? []) as CustomerRow[]).map((row) => {
      const c = mapCustomerRow(row);
      return { id: c.id, label: `${c.first_name} ${c.last_name}` };
    });

    vehicleTypes = (
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

    if (settingsRow) {
      const s = settingsRow as {
        default_insurance: number | null;
        default_delivery_fee: number | null;
        default_deposit: number | null;
        quote_terms: string | null;
      };
      defaults.insuranceAmount = s.default_insurance ?? 0;
      defaults.deliveryFee = s.default_delivery_fee ?? 0;
      defaults.depositAmount = s.default_deposit ?? 0;
      defaults.terms = s.quote_terms ?? undefined;
    }

    const requestId = params.requestId ? String(params.requestId) : undefined;
    if (requestId) {
      const reqResult = await getWebRequest(requestId);
      if (reqResult.success) {
        const req = reqResult.data;
        defaults.webRequestId = requestId;
        defaults.customerId =
          (req.customer_id ?? String(params.customerId ?? "")) || undefined;
        if (req.pickup_date && req.return_date) {
          const startUtc = appLocalDateTimeToUtc(
            req.pickup_date,
            req.pickup_time ?? "09:00",
          );
          const endUtc = appLocalDateTimeToUtc(
            req.return_date,
            req.return_time ?? "09:00",
          );
          defaults.startAt = toDatetimeLocalValue(startUtc);
          defaults.endAt = toDatetimeLocalValue(endUtc);
        }

        const category = (req.vehicle_category ?? "").trim().toLowerCase();
        if (category) {
          const matched = vehicleTypes.find(
            (t) =>
              t.name.toLowerCase() === category ||
              t.name.toLowerCase().includes(category) ||
              category.includes(t.name.toLowerCase()) ||
              (t.nameEn && t.nameEn.toLowerCase() === category),
          );
          if (matched) defaults.vehicleTypeId = matched.id;
        }

        if (!defaults.vehicleTypeId && req.vehicle_id) {
          const { data: unit } = await supabase
            .from("vehicles")
            .select("vehicle_type_id, category")
            .eq("id", req.vehicle_id)
            .maybeSingle();
          if (unit?.vehicle_type_id) {
            defaults.vehicleTypeId = unit.vehicle_type_id as string;
          } else if (unit?.category) {
            const cat = String(unit.category).toLowerCase();
            const matched = vehicleTypes.find(
              (t) =>
                t.name.toLowerCase() === cat ||
                t.name.toLowerCase().includes(cat),
            );
            if (matched) defaults.vehicleTypeId = matched.id;
          }
        }
      }
    }
  }

  return (
    <PermissionGuard permission="quotes.create">
      <div className="space-y-6">
        <PageHeader
          title="Nueva cotización"
          breadcrumbs={[
            { label: "Cotizaciones", href: "/dashboard/cotizaciones" },
            { label: "Nueva" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : customers.length === 0 ? (
          <p className="text-sm text-muted">
            Se requiere al menos un cliente registrado para crear una
            cotización.
          </p>
        ) : vehicleTypes.length === 0 ? (
          <p className="text-sm text-muted">
            No hay tipos de vehículo activos. Configure el catálogo en
            Configuración → Tipos de vehículo.
          </p>
        ) : (
          <QuoteForm
            customers={customers}
            vehicleTypes={vehicleTypes}
            catalogItems={catalogItems}
            defaults={defaults}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
