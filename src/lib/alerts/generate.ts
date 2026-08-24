import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

const PICKUP_RETURN_WINDOW_HOURS = 48;
const MAINTENANCE_DATE_WINDOW_DAYS = 14;

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type AlertInsert = {
  alert_type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  severity: string;
  dedupe_key: string;
  due_at: string | null;
};

export type GenerateAlertsResult = {
  created: number;
  resolved: number;
  error: string | null;
};

async function upsertAlert(supabase: Awaited<ReturnType<typeof createClient>>, alert: AlertInsert) {
  const { data: existing } = await supabase
    .from("alerts")
    .select("id")
    .eq("dedupe_key", alert.dedupe_key)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("alerts")
      .update({
        title: alert.title,
        message: alert.message,
        due_at: alert.due_at,
        severity: alert.severity,
      })
      .eq("id", (existing as { id: string }).id);
    return false;
  }

  const { error } = await supabase.from("alerts").insert(alert);
  if (error && !error.message.includes("duplicate")) {
    throw new Error(error.message);
  }
  return !error;
}

export async function generateAlerts(): Promise<GenerateAlertsResult> {
  if (!isSupabaseConfigured()) {
    return { created: 0, resolved: 0, error: null };
  }

  try {
    const supabase = await createClient();
    const now = new Date();
    const pickupCutoff = new Date(
      now.getTime() + PICKUP_RETURN_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const maintenanceCutoff = new Date(
      now.getTime() + MAINTENANCE_DATE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    let created = 0;
    const activeDedupeKeys = new Set<string>();

    const [reservationsRes, maintenanceRes] = await Promise.all([
      supabase
        .from("reservations")
        .select(
          "id, code, status, start_at, end_at, vehicle_id, customer_id, vehicles(brand, model, plate), customers(first_name, last_name)",
        )
        .in("status", ["CONFIRMED", "ACTIVE"])
        .is("deleted_at", null),
      supabase
        .from("maintenance_records")
        .select(
          "id, vehicle_id, type, next_date, next_mileage, status, vehicles(brand, model, plate, current_mileage)",
        )
        .neq("status", "CANCELLED")
        .not("next_date", "is", null),
    ]);

    if (reservationsRes.error) throw new Error(reservationsRes.error.message);
    if (maintenanceRes.error) throw new Error(maintenanceRes.error.message);

    for (const row of reservationsRes.data ?? []) {
      const reservation = row as {
        id: string;
        code: string;
        status: string;
        start_at: string;
        end_at: string;
        vehicles:
          | { brand: string; model: string; plate: string }
          | Array<{ brand: string; model: string; plate: string }>
          | null;
        customers:
          | { first_name: string; last_name: string }
          | Array<{ first_name: string; last_name: string }>
          | null;
      };

      const vehicle = unwrapRelation(reservation.vehicles);
      const customer = unwrapRelation(reservation.customers);

      const vehicleLabel = vehicle
        ? `${vehicle.brand} ${vehicle.model} (${vehicle.plate})`
        : "Vehículo";
      const customerLabel = customer
        ? `${customer.first_name} ${customer.last_name}`
        : "Cliente";

      const startAt = new Date(reservation.start_at);
      const endAt = new Date(reservation.end_at);

      if (
        reservation.status === "CONFIRMED" &&
        startAt >= now &&
        startAt <= pickupCutoff
      ) {
        const dedupeKey = `pickup:${reservation.id}`;
        activeDedupeKeys.add(dedupeKey);
        const inserted = await upsertAlert(supabase, {
          alert_type: "pickup_due",
          title: `Entrega próxima — ${reservation.code}`,
          message: `${customerLabel} recogerá ${vehicleLabel}.`,
          entity_type: "reservation",
          entity_id: reservation.id,
          severity: "warning",
          dedupe_key: dedupeKey,
          due_at: reservation.start_at,
        });
        if (inserted) created += 1;
      }

      if (
        reservation.status === "ACTIVE" &&
        endAt >= now &&
        endAt <= pickupCutoff
      ) {
        const dedupeKey = `return:${reservation.id}`;
        activeDedupeKeys.add(dedupeKey);
        const inserted = await upsertAlert(supabase, {
          alert_type: "return_due",
          title: `Devolución próxima — ${reservation.code}`,
          message: `${customerLabel} devolverá ${vehicleLabel}.`,
          entity_type: "reservation",
          entity_id: reservation.id,
          severity: "warning",
          dedupe_key: dedupeKey,
          due_at: reservation.end_at,
        });
        if (inserted) created += 1;
      }
    }

    for (const row of maintenanceRes.data ?? []) {
      const record = row as {
        id: string;
        vehicle_id: string;
        type: string;
        next_date: string;
        next_mileage: number | null;
        vehicles:
          | {
              brand: string;
              model: string;
              plate: string;
              current_mileage: number | null;
            }
          | Array<{
              brand: string;
              model: string;
              plate: string;
              current_mileage: number | null;
            }>
          | null;
      };

      const vehicle = unwrapRelation(record.vehicles);
      const vehicleLabel = vehicle
        ? `${vehicle.brand} ${vehicle.model} (${vehicle.plate})`
        : "Vehículo";

      const nextDate = new Date(`${record.next_date}T00:00:00`);
      if (nextDate >= now && nextDate <= maintenanceCutoff) {
        const dedupeKey = `maintenance:date:${record.id}`;
        activeDedupeKeys.add(dedupeKey);
        const inserted = await upsertAlert(supabase, {
          alert_type: "maintenance_due_date",
          title: `Mantenimiento programado — ${vehicleLabel}`,
          message: `Próximo servicio (${record.type}) el ${record.next_date}.`,
          entity_type: "maintenance",
          entity_id: record.id,
          severity: "info",
          dedupe_key: dedupeKey,
          due_at: `${record.next_date}T08:00:00`,
        });
        if (inserted) created += 1;
      }

      if (
        record.next_mileage != null &&
        vehicle?.current_mileage != null &&
        vehicle.current_mileage >= record.next_mileage - 500
      ) {
        const dedupeKey = `maintenance:mileage:${record.id}`;
        activeDedupeKeys.add(dedupeKey);
        const inserted = await upsertAlert(supabase, {
          alert_type: "maintenance_due_mileage",
          title: `Mantenimiento por kilometraje — ${vehicleLabel}`,
          message: `Kilometraje actual ${vehicle.current_mileage} km; próximo servicio a ${record.next_mileage} km.`,
          entity_type: "maintenance",
          entity_id: record.id,
          severity: "info",
          dedupe_key: dedupeKey,
          due_at: null,
        });
        if (inserted) created += 1;
      }
    }

    const { data: staleAlerts } = await supabase
      .from("alerts")
      .select("id, dedupe_key")
      .eq("is_active", true)
      .not("dedupe_key", "is", null);

    let resolved = 0;
    for (const alert of staleAlerts ?? []) {
      const row = alert as { id: string; dedupe_key: string | null };
      if (row.dedupe_key && !activeDedupeKeys.has(row.dedupe_key)) {
        await supabase
          .from("alerts")
          .update({
            is_active: false,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        resolved += 1;
      }
    }

    return { created, resolved, error: null };
  } catch (error) {
    return {
      created: 0,
      resolved: 0,
      error: error instanceof Error ? error.message : "Error al generar alertas",
    };
  }
}
