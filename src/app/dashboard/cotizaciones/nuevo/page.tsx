import { getWebRequest } from "@/app/dashboard/solicitudes/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import {
  QuoteForm,
  type QuoteCatalogItem,
} from "@/components/forms/quote-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { appLocalDateTimeToUtc, toDatetimeLocalValue } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  mapCustomerRow,
  mapVehicleRow,
  type CustomerRow,
  type VehicleRow,
} from "@/lib/db/mappers";

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();

  let customers: Array<{ id: string; label: string }> = [];
  let vehicles: Array<{
    id: string;
    label: string;
    dailyRate: number;
    deposit: number;
  }> = [];
  let catalogItems: QuoteCatalogItem[] = [];
  const defaults: {
    customerId?: string;
    vehicleId?: string;
    webRequestId?: string;
    startAt?: string;
    endAt?: string;
    insuranceAmount?: number;
    depositAmount?: number;
    deliveryFee?: number;
    terms?: string;
    language?: "es" | "en";
  } = { language: "en" };

  if (configured) {
    const supabase = await createClient();
    const [
      { data: customerRows },
      { data: vehicleRows },
      { data: settingsRow },
      catalogResult,
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .is("deleted_at", null)
        .order("last_name"),
      supabase
        .from("vehicles")
        .select("*")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("brand"),
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

    vehicles = ((vehicleRows ?? []) as VehicleRow[]).map((row) => {
      const v = mapVehicleRow(row);
      return {
        id: v.id,
        label: `${v.brand} ${v.model} ${v.year} · $${Number(v.daily_rate).toFixed(2)}/día`,
        dailyRate: v.daily_rate,
        deposit: v.deposit ?? 0,
      };
    });

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
        defaults.vehicleId = req.vehicle_id ?? undefined;
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

        if (req.vehicle_id) {
          const vehicle = vehicles.find((v) => v.id === req.vehicle_id);
          if (vehicle) {
            defaults.depositAmount = vehicle.deposit;
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
        ) : (
          <QuoteForm
            customers={customers}
            vehicles={vehicles}
            catalogItems={catalogItems}
            defaults={defaults}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
