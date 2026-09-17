import { getQuote } from "@/app/dashboard/cotizaciones/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { ReservationForm } from "@/components/forms/reservation-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageCourtesyDiscount } from "@/lib/auth/permissions";
import { deriveReservationPricingFromQuote } from "@/lib/calculations/quote";
import { toCustomerSelectOption } from "@/lib/customers";
import { isSupabaseConfigured } from "@/lib/env";
import { asNumber } from "@/lib/safe-number";
import { createClient } from "@/lib/supabase/server";
import { vehicleSelectParts } from "@/lib/vehicles/label";
import {
  mapCustomerRow,
  mapVehicleRow,
  type CustomerRow,
  type VehicleRow,
} from "@/lib/db/mappers";

export default async function NuevaReservaPage({
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
    primary?: string;
    secondary?: string;
    searchText?: string;
    dailyRate: number;
    deposit: number;
    category?: string | null;
  }> = [];
  const defaults: {
    customerId?: string;
    vehicleId?: string;
    quoteId?: string;
    quoteCode?: string;
    startAt?: string;
    endAt?: string;
    agreedRate?: number;
    deposit?: number;
    cashAmount?: number;
    additionalCosts?: number;
    total?: number;
    vehicleType?: string;
    notes?: string;
    quoteExtraLines?: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }>;
  } = {};
  let canManageCourtesy = false;

  if (configured) {
    const user = await getCurrentUser();
    if (user) {
      canManageCourtesy = await canManageCourtesyDiscount(user.id);
    }
    const supabase = await createClient();
    const [{ data: customerRows }, { data: vehicleRows }] = await Promise.all([
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
        .order("plate"),
    ]);

    customers = ((customerRows ?? []) as CustomerRow[]).map((row) =>
      toCustomerSelectOption(mapCustomerRow(row)),
    );

    vehicles = ((vehicleRows ?? []) as VehicleRow[]).map((row) => {
      const v = mapVehicleRow(row);
      const parts = vehicleSelectParts({
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        year: v.year,
        daily_rate: v.daily_rate,
      });
      return {
        id: v.id,
        label: parts.label,
        primary: parts.primary,
        secondary: parts.secondary,
        searchText: parts.searchText,
        dailyRate: v.daily_rate,
        deposit: v.deposit ?? 0,
        category: v.category,
      };
    });

    const quoteId = params.quoteId ? String(params.quoteId) : undefined;
    if (quoteId) {
      const quoteResult = await getQuote(quoteId);
      if (quoteResult.success) {
        const q = quoteResult.data;
        const { data: itemRows } = await supabase
          .from("quote_items")
          .select(
            "description, quantity, unit_price, amount, item_type, sort_order",
          )
          .eq("quote_id", quoteId)
          .order("sort_order", { ascending: true });

        const lines = (itemRows ?? []).map((item) => ({
          description: String(item.description ?? ""),
          quantity: asNumber(item.quantity, 0),
          unit_price: asNumber(item.unit_price, 0),
          amount: asNumber(
            item.amount,
            asNumber(item.quantity, 0) * asNumber(item.unit_price, 0),
          ),
          item_type: (item.item_type as string | null) ?? null,
        }));

        const pricing = deriveReservationPricingFromQuote({
          dailyRate: q.daily_rate,
          rentalDays: q.rental_days,
          quoteTotal: q.total,
          lines,
        });

        const extrasNote =
          pricing.extraLines.length > 0
            ? [
                `Extras desde cotización ${q.code}:`,
                ...pricing.extraLines.map(
                  (line) =>
                    `- ${line.description}: $${line.amount.toFixed(2)}`,
                ),
              ].join("\n")
            : pricing.additionalCosts > 0
              ? `Extras desde cotización ${q.code}: $${pricing.additionalCosts.toFixed(2)}`
              : "";

        defaults.quoteId = q.id;
        defaults.quoteCode = q.code;
        defaults.customerId = q.customer_id;
        defaults.vehicleId = q.vehicle_id ?? undefined;
        defaults.startAt = q.start_at;
        defaults.endAt = q.end_at;
        defaults.agreedRate = pricing.agreedRate;
        defaults.deposit = q.deposit_amount;
        defaults.additionalCosts = pricing.additionalCosts;
        defaults.total = pricing.total;
        defaults.cashAmount = pricing.total;
        defaults.quoteExtraLines = pricing.extraLines;
        defaults.notes = [q.notes?.trim() || "", extrasNote]
          .filter(Boolean)
          .join("\n\n");

        if (q.vehicle_id) {
          const matched = vehicles.find((v) => v.id === q.vehicle_id);
          if (matched?.category) defaults.vehicleType = matched.category;
        }
      }
    }
  }

  return (
    <PermissionGuard permission="reservations.create">
      <div className="space-y-6">
        <PageHeader
          title="Nueva reserva"
          breadcrumbs={[
            { label: "Reservas", href: "/dashboard/reservas" },
            { label: "Nueva" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : (
          <ReservationForm
            customers={customers}
            vehicles={vehicles}
            defaults={defaults}
            canManageCourtesy={canManageCourtesy}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
