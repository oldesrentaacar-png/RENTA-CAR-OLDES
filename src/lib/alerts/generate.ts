import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  WEB_REQUEST_ALERT_TTL_HOURS,
  findRelatedRequestsInWindow,
  formatRelatedRequestsNote,
  webRequestAlertWindowStart,
  type RecentWebRequestRef,
} from "@/lib/alerts/web-request-window";
import { getCustomerDisplayName } from "@/lib/customers";
import { formatAppDate, formatAppTime12h } from "@/lib/dates";
import { formatVehicleLabel } from "@/lib/vehicles/label";

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

type CustomerJoin = {
  first_name: string;
  last_name: string;
  company_name?: string | null;
  customer_type?: "PERSON" | "COMPANY" | null;
};

type VehicleJoin = {
  brand: string;
  model: string;
  plate: string;
  year?: number | null;
};

export type GenerateAlertsResult = {
  created: number;
  resolved: number;
  error: string | null;
};

function customerLabelFrom(customer: CustomerJoin | null): string {
  if (!customer) return "Cliente";
  return (
    getCustomerDisplayName({
      customer_type: customer.customer_type === "COMPANY" ? "COMPANY" : "PERSON",
      first_name: customer.first_name,
      last_name: customer.last_name,
      company_name: customer.company_name ?? null,
    }) || "Cliente"
  );
}

function vehicleLabelFrom(vehicle: VehicleJoin | null): string {
  if (!vehicle) return "Vehículo";
  return formatVehicleLabel(vehicle, { includeBrand: true });
}

/** Ej: "Jorge Ortiz · 8:00 p. m." */
function personAndTimeLabel(person: string, at: string): string {
  return `${person} · ${formatAppTime12h(at)}`;
}

async function upsertAlert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  alert: AlertInsert,
) {
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
        alert_type: alert.alert_type,
        title: alert.title,
        message: alert.message,
        due_at: alert.due_at,
        severity: alert.severity,
        entity_type: alert.entity_type,
        entity_id: alert.entity_id,
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

    const requestAlertWindowStart = webRequestAlertWindowStart(now);

    const [
      reservationsRes,
      maintenanceRes,
      webRequestsRes,
      recentRequestsRes,
      overdueContractsRes,
    ] = await Promise.all([
      supabase
        .from("reservations")
        .select(
          "id, code, status, start_at, end_at, vehicle_id, customer_id, vehicles(brand, model, year, plate), customers(first_name, last_name, company_name, customer_type)",
        )
        .in("status", ["CONFIRMED", "ACTIVE"])
        .is("deleted_at", null),
      supabase
        .from("maintenance_records")
        .select(
          "id, vehicle_id, type, next_date, next_mileage, status, vehicles(brand, model, plate, current_mileage)",
        )
        .neq("status", "CANCELLED")
        .is("deleted_at", null)
        .or("next_date.not.is.null,next_mileage.not.is.null"),
      supabase
        .from("web_requests")
        .select(
          "id, code, first_name, last_name, phone, email, pickup_date, return_date, vehicle_category, created_at",
        )
        .eq("status", "PENDING")
        .is("deleted_at", null)
        .gte("created_at", requestAlertWindowStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("web_requests")
        .select("id, code, status, phone, email, created_at, first_name, last_name")
        .is("deleted_at", null)
        .gte("created_at", requestAlertWindowStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(300),
      // Contratos abiertos cuya fecha de fin ya pasó y no se han cerrado.
      supabase
        .from("contracts")
        .select(
          "id, code, status, end_at, closed_at, vehicles(brand, model, year, plate), customers(first_name, last_name, company_name, customer_type)",
        )
        .is("deleted_at", null)
        .is("closed_at", null)
        .not("status", "in", '("COMPLETED","CANCELLED")')
        .lt("end_at", now.toISOString())
        .order("end_at", { ascending: true })
        .limit(150),
    ]);

    if (reservationsRes.error) throw new Error(reservationsRes.error.message);
    if (maintenanceRes.error) throw new Error(maintenanceRes.error.message);
    if (webRequestsRes.error) throw new Error(webRequestsRes.error.message);
    if (recentRequestsRes.error) throw new Error(recentRequestsRes.error.message);
    if (overdueContractsRes.error) {
      throw new Error(overdueContractsRes.error.message);
    }

    const recentPool = (recentRequestsRes.data ?? []) as RecentWebRequestRef[];

    for (const row of reservationsRes.data ?? []) {
      const reservation = row as {
        id: string;
        code: string;
        status: string;
        start_at: string;
        end_at: string;
        vehicles: VehicleJoin | VehicleJoin[] | null;
        customers: CustomerJoin | CustomerJoin[] | null;
      };

      const vehicle = unwrapRelation(reservation.vehicles);
      const customer = unwrapRelation(reservation.customers);
      const vehicleLabel = vehicleLabelFrom(vehicle);
      const customerLabel = customerLabelFrom(customer);

      const startAt = new Date(reservation.start_at);
      const endAt = new Date(reservation.end_at);

      // Entrega: próximas 48h o ya vencida (CONFIRMED sin entregar).
      if (reservation.status === "CONFIRMED" && startAt <= pickupCutoff) {
        const isOverdue = startAt < now;
        const dedupeKey = `pickup:${reservation.id}`;
        activeDedupeKeys.add(dedupeKey);
        const when = personAndTimeLabel(customerLabel, reservation.start_at);
        const inserted = await upsertAlert(supabase, {
          alert_type: isOverdue ? "pickup_overdue" : "pickup_due",
          title: isOverdue
            ? `Entrega vencida — ${when}`
            : `Entrega próxima — ${when}`,
          message: vehicleLabel,
          entity_type: "reservation",
          entity_id: reservation.id,
          severity: isOverdue ? "danger" : "warning",
          dedupe_key: dedupeKey,
          due_at: reservation.start_at,
        });
        if (inserted) created += 1;
      }

      // Devolución: próximas 48h o ya vencida (ACTIVE sin devolver).
      if (reservation.status === "ACTIVE" && endAt <= pickupCutoff) {
        const isOverdue = endAt < now;
        const dedupeKey = `return:${reservation.id}`;
        activeDedupeKeys.add(dedupeKey);
        const when = personAndTimeLabel(customerLabel, reservation.end_at);
        const inserted = await upsertAlert(supabase, {
          alert_type: isOverdue ? "return_overdue" : "return_due",
          title: isOverdue
            ? `Devolución vencida — ${when}`
            : `Devolución próxima — ${when}`,
          message: vehicleLabel,
          entity_type: "reservation",
          entity_id: reservation.id,
          severity: isOverdue ? "danger" : "warning",
          dedupe_key: dedupeKey,
          due_at: reservation.end_at,
        });
        if (inserted) created += 1;
      }
    }

    for (const row of overdueContractsRes.data ?? []) {
      const contract = row as {
        id: string;
        code: string;
        status: string;
        end_at: string;
        vehicles: VehicleJoin | VehicleJoin[] | null;
        customers: CustomerJoin | CustomerJoin[] | null;
      };

      const vehicle = unwrapRelation(contract.vehicles);
      const customer = unwrapRelation(contract.customers);
      const vehicleLabel = vehicleLabelFrom(vehicle);
      const customerLabel = customerLabelFrom(customer);
      const dedupeKey = `contract:overdue:${contract.id}`;
      activeDedupeKeys.add(dedupeKey);

      const when = personAndTimeLabel(customerLabel, contract.end_at);
      const inserted = await upsertAlert(supabase, {
        alert_type: "contract_overdue",
        title: `Contrato sin cerrar — ${when}`,
        message: `Venció ${formatAppDate(contract.end_at)} · ${vehicleLabel}`,
        entity_type: "contract",
        entity_id: contract.id,
        severity: "danger",
        dedupe_key: dedupeKey,
        due_at: contract.end_at,
      });
      if (inserted) created += 1;
    }

    for (const row of maintenanceRes.data ?? []) {
      const record = row as {
        id: string;
        vehicle_id: string;
        type: string;
        next_date: string | null;
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

      if (record.next_date) {
        const nextDate = new Date(`${record.next_date}T00:00:00`);
        if (!Number.isNaN(nextDate.getTime()) && nextDate <= maintenanceCutoff) {
          const isOverdue = nextDate < now;
          const dedupeKey = `maintenance:date:${record.id}`;
          activeDedupeKeys.add(dedupeKey);
          const inserted = await upsertAlert(supabase, {
            alert_type: "maintenance_due_date",
            title: isOverdue
              ? `Mantenimiento vencido — ${vehicleLabel}`
              : `Mantenimiento programado — ${vehicleLabel}`,
            message: isOverdue
              ? `Servicio (${record.type}) vencido desde el ${record.next_date}.`
              : `Próximo servicio (${record.type}) el ${record.next_date}.`,
            entity_type: "maintenance",
            entity_id: record.id,
            severity: isOverdue ? "warning" : "info",
            dedupe_key: dedupeKey,
            due_at: `${record.next_date}T08:00:00`,
          });
          if (inserted) created += 1;
        }
      }

      if (
        record.next_mileage != null &&
        vehicle?.current_mileage != null &&
        vehicle.current_mileage >= record.next_mileage - 500
      ) {
        const isOverdue = vehicle.current_mileage >= record.next_mileage;
        const dedupeKey = `maintenance:mileage:${record.id}`;
        activeDedupeKeys.add(dedupeKey);
        const inserted = await upsertAlert(supabase, {
          alert_type: "maintenance_due_mileage",
          title: isOverdue
            ? `Mantenimiento por km vencido — ${vehicleLabel}`
            : `Mantenimiento por kilometraje — ${vehicleLabel}`,
          message: isOverdue
            ? `Kilometraje actual ${vehicle.current_mileage} km ya alcanzó o superó el servicio a ${record.next_mileage} km.`
            : `Kilometraje actual ${vehicle.current_mileage} km; próximo servicio a ${record.next_mileage} km.`,
          entity_type: "maintenance",
          entity_id: record.id,
          severity: isOverdue ? "warning" : "info",
          dedupe_key: dedupeKey,
          due_at: null,
        });
        if (inserted) created += 1;
      }
    }

    for (const row of webRequestsRes.data ?? []) {
      const request = row as {
        id: string;
        code: string;
        first_name: string;
        last_name: string;
        phone: string;
        email: string | null;
        pickup_date: string;
        return_date: string;
        vehicle_category: string | null;
        created_at: string;
      };

      const createdAt = new Date(request.created_at);
      if (Number.isNaN(createdAt.getTime()) || createdAt < requestAlertWindowStart) {
        continue;
      }

      const name = `${request.first_name} ${request.last_name}`.trim();
      const category = request.vehicle_category?.trim() || "Sin categoría";
      const related = findRelatedRequestsInWindow(
        { id: request.id, phone: request.phone },
        recentPool,
      );
      const relatedNote = formatRelatedRequestsNote(related);
      const baseMessage = `${name} · ${request.phone} · ${category} · ${request.pickup_date} → ${request.return_date}`;
      const message = relatedNote
        ? `${baseMessage}. ${relatedNote}`
        : `${baseMessage}. Vigente ${WEB_REQUEST_ALERT_TTL_HOURS}h.`;

      const dedupeKey = `web_request:pending:${request.id}`;
      activeDedupeKeys.add(dedupeKey);

      const dueAt = new Date(
        createdAt.getTime() + WEB_REQUEST_ALERT_TTL_HOURS * 60 * 60 * 1000,
      ).toISOString();

      const inserted = await upsertAlert(supabase, {
        alert_type: "web_request_pending",
        title: relatedNote
          ? `Solicitud repetida — ${name}`
          : `Solicitud pendiente — ${name}`,
        message,
        entity_type: "web_request",
        entity_id: request.id,
        severity: relatedNote ? "danger" : "warning",
        dedupe_key: dedupeKey,
        due_at: dueAt,
      });
      if (inserted) created += 1;
    }

    // Aviso operativo de WebBoost: problemas del piloto ya resueltos.
    const webboostDedupeKey = "webboost:support:problems-resolved-v1";
    activeDedupeKeys.add(webboostDedupeKey);
    const webboostInserted = await upsertAlert(supabase, {
      alert_type: "webboost_notice",
      title: "WebBoost — Problemas solucionados",
      message: "Los problemas reportados ya fueron solucionados.",
      entity_type: "webboost",
      entity_id: null,
      severity: "info",
      dedupe_key: webboostDedupeKey,
      due_at: now.toISOString(),
    });
    if (webboostInserted) created += 1;

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
