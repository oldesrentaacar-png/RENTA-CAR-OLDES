import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  getMonthBounds,
  sumRealIncome,
  type ExpenseRow,
  type IncomeRow,
} from "@/lib/calculations/profitability";
import { formatAppTime, getAppDayBounds } from "@/lib/dates";

export type FetchListResult<T> = {
  data: T[];
  error: string | null;
  configured: boolean;
};

export async function fetchList<T>(
  table: string,
  select: string,
  orderBy: { column: string; ascending?: boolean } = {
    column: "created_at",
    ascending: false,
  },
  limit = 50,
): Promise<FetchListResult<T>> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null, configured: false };
  }

  try {
    const supabase = await createClient();
    let query = supabase
      .from(table)
      .select(select)
      .order(orderBy.column, { ascending: orderBy.ascending ?? false })
      .limit(limit);

    if (table === "income_transactions" || table === "expense_transactions") {
      query = query.is("deleted_at", null);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: error.message, configured: true };
    }

    return { data: (data ?? []) as T[], error: null, configured: true };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : "Error desconocido",
      configured: true,
    };
  }
}

export type DashboardMetrics = {
  configured: boolean;
  error: string | null;
  pendingRequests: number;
  activeReservations: number;
  availableVehicles: number;
  totalCustomers: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  activeAlerts: number;
  vehiclesByStatus: { status: string; count: number }[];
  requestsByStatus: { status: string; count: number }[];
};

export type OpsAgendaItem = {
  id: string;
  code: string;
  status: string;
  start_at: string;
  end_at: string;
  customerName: string;
  vehicleLabel: string;
  href: string;
};

export type OpsPendingRequest = {
  id: string;
  code: string;
  name: string;
  pickupLabel: string;
  href: string;
};

export type OpsOpenContract = {
  id: string;
  code: string;
  status: string;
  start_at: string;
  end_at: string;
  customerName: string;
  vehicleLabel: string;
  href: string;
  /** True when end_at is already past — likely left open by mistake. */
  isOverdue: boolean;
};

export type DashboardOpsAgenda = {
  configured: boolean;
  error: string | null;
  todayLabel: string;
  tomorrowLabel: string;
  pendingRequestsCount: number;
  pendingRequests: OpsPendingRequest[];
  reservationsToday: OpsAgendaItem[];
  reservationsTomorrow: OpsAgendaItem[];
  deliveriesToday: OpsAgendaItem[];
  returnsToday: OpsAgendaItem[];
  openContracts: OpsOpenContract[];
  openContractAlerts: OpsOpenContract[];
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function customerLabel(
  customer:
    | { first_name: string | null; last_name: string | null }
    | null
    | undefined,
): string {
  return (
    `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() ||
    "Cliente"
  );
}

function vehicleLabel(
  vehicle:
    | {
        brand: string | null;
        model: string | null;
        plate: string | null;
      }
    | null
    | undefined,
): string {
  const plate = vehicle?.plate?.trim();
  const model =
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ").trim() ||
    vehicle?.model?.trim() ||
    "";
  if (plate && model) return `${plate} · ${model}`;
  return plate || model || "Vehículo";
}

type ReservationJoinRow = {
  id: string;
  code: string;
  status: string;
  start_at: string;
  end_at: string;
  customers:
    | { first_name: string | null; last_name: string | null }
    | Array<{ first_name: string | null; last_name: string | null }>
    | null;
  vehicles:
    | { brand: string | null; model: string | null; plate: string | null }
    | Array<{ brand: string | null; model: string | null; plate: string | null }>
    | null;
};

function mapReservationAgendaItem(row: ReservationJoinRow): OpsAgendaItem {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    start_at: row.start_at,
    end_at: row.end_at,
    customerName: customerLabel(unwrapRelation(row.customers)),
    vehicleLabel: vehicleLabel(unwrapRelation(row.vehicles)),
    href: `/dashboard/reservas/${row.id}`,
  };
}

type ContractJoinRow = {
  id: string;
  code: string;
  status: string;
  start_at: string;
  end_at: string;
  customers:
    | { first_name: string | null; last_name: string | null }
    | Array<{ first_name: string | null; last_name: string | null }>
    | null;
  vehicles:
    | { brand: string | null; model: string | null; plate: string | null }
    | Array<{ brand: string | null; model: string | null; plate: string | null }>
    | null;
};

function mapOpenContract(row: ContractJoinRow, nowIso: string): OpsOpenContract {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    start_at: row.start_at,
    end_at: row.end_at,
    customerName: customerLabel(unwrapRelation(row.customers)),
    vehicleLabel: vehicleLabel(unwrapRelation(row.vehicles)),
    href: `/dashboard/contratos/${row.id}`,
    isOverdue: row.end_at < nowIso,
  };
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const empty: DashboardMetrics = {
    configured: false,
    error: null,
    pendingRequests: 0,
    activeReservations: 0,
    availableVehicles: 0,
    totalCustomers: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    activeAlerts: 0,
    vehiclesByStatus: [],
    requestsByStatus: [],
  };

  if (!isSupabaseConfigured()) {
    return empty;
  }

  try {
    const supabase = await createClient();
    const { from, to } = getMonthBounds();

    const [
      requestsRes,
      reservationsRes,
      vehiclesRes,
      customersRes,
      incomeRes,
      expenseRes,
      allVehiclesRes,
      allRequestsRes,
      alertsRes,
    ] = await Promise.all([
      supabase
        .from("web_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING"),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .in("status", ["CONFIRMED", "ACTIVE"]),
      supabase
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("status", "AVAILABLE")
        .eq("is_active", true),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("income_transactions")
        .select("type, amount, deposit_status, vehicle_id, transaction_date")
        .is("deleted_at", null)
        .gte("transaction_date", from)
        .lte("transaction_date", to),
      supabase
        .from("expense_transactions")
        .select("amount, vehicle_id, expense_date")
        .is("deleted_at", null)
        .gte("expense_date", from)
        .lte("expense_date", to),
      supabase.from("vehicles").select("status").eq("is_active", true),
      supabase.from("web_requests").select("status"),
      supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    const firstError =
      requestsRes.error ??
      reservationsRes.error ??
      vehiclesRes.error ??
      customersRes.error;

    if (firstError) {
      return { ...empty, configured: true, error: firstError.message };
    }

    const vehicleRows = (allVehiclesRes.data ?? []) as Array<{ status: string }>;
    const requestRows = (allRequestsRes.data ?? []) as Array<{ status: string }>;

    const countBy = (rows: Array<{ status: string }>) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        map.set(row.status, (map.get(row.status) ?? 0) + 1);
      }
      return [...map.entries()].map(([status, count]) => ({ status, count }));
    };

    const incomeRows = (incomeRes.data ?? []) as IncomeRow[];
    const expenseRows = (expenseRes.data ?? []) as ExpenseRow[];

    return {
      configured: true,
      error: null,
      pendingRequests: requestsRes.count ?? 0,
      activeReservations: reservationsRes.count ?? 0,
      availableVehicles: vehiclesRes.count ?? 0,
      totalCustomers: customersRes.count ?? 0,
      monthlyIncome: sumRealIncome(incomeRows),
      monthlyExpenses: expenseRows.reduce((sum, row) => sum + row.amount, 0),
      activeAlerts: alertsRes.count ?? 0,
      vehiclesByStatus: countBy(vehicleRows),
      requestsByStatus: countBy(requestRows),
    };
  } catch (err) {
    return {
      ...empty,
      configured: true,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

export async function fetchDashboardOpsAgenda(): Promise<DashboardOpsAgenda> {
  const today = getAppDayBounds(0);
  const tomorrow = getAppDayBounds(1);
  const empty: DashboardOpsAgenda = {
    configured: false,
    error: null,
    todayLabel: today.date,
    tomorrowLabel: tomorrow.date,
    pendingRequestsCount: 0,
    pendingRequests: [],
    reservationsToday: [],
    reservationsTomorrow: [],
    deliveriesToday: [],
    returnsToday: [],
    openContracts: [],
    openContractAlerts: [],
  };

  if (!isSupabaseConfigured()) {
    return empty;
  }

  try {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const reservationSelect =
      "id, code, status, start_at, end_at, customers(first_name, last_name), vehicles(brand, model, plate)";
    const contractSelect =
      "id, code, status, start_at, end_at, customers(first_name, last_name), vehicles(brand, model, plate)";

    const [
      pendingCountRes,
      pendingListRes,
      todayRes,
      tomorrowRes,
      deliveriesRes,
      returnsRes,
      openContractsRes,
    ] = await Promise.all([
      supabase
        .from("web_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING"),
      supabase
        .from("web_requests")
        .select(
          "id, code, first_name, last_name, pickup_date, pickup_time, status",
        )
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("reservations")
        .select(reservationSelect)
        .is("deleted_at", null)
        .gte("start_at", today.startIso)
        .lt("start_at", today.endExclusiveIso)
        .neq("status", "CANCELLED")
        .order("start_at", { ascending: true })
        .limit(20),
      supabase
        .from("reservations")
        .select(reservationSelect)
        .is("deleted_at", null)
        .gte("start_at", tomorrow.startIso)
        .lt("start_at", tomorrow.endExclusiveIso)
        .neq("status", "CANCELLED")
        .order("start_at", { ascending: true })
        .limit(20),
      supabase
        .from("reservations")
        .select(reservationSelect)
        .is("deleted_at", null)
        .eq("status", "CONFIRMED")
        .gte("start_at", today.startIso)
        .lt("start_at", today.endExclusiveIso)
        .order("start_at", { ascending: true })
        .limit(20),
      supabase
        .from("reservations")
        .select(reservationSelect)
        .is("deleted_at", null)
        .in("status", ["ACTIVE", "CONFIRMED"])
        .gte("end_at", today.startIso)
        .lt("end_at", today.endExclusiveIso)
        .order("end_at", { ascending: true })
        .limit(20),
      supabase
        .from("contracts")
        .select(contractSelect)
        .is("deleted_at", null)
        .neq("status", "COMPLETED")
        .neq("status", "CANCELLED")
        .order("end_at", { ascending: true })
        .limit(30),
    ]);

    const firstError =
      pendingCountRes.error ??
      pendingListRes.error ??
      todayRes.error ??
      tomorrowRes.error ??
      deliveriesRes.error ??
      returnsRes.error ??
      openContractsRes.error;

    if (firstError) {
      return { ...empty, configured: true, error: firstError.message };
    }

    const pendingRequests: OpsPendingRequest[] = (
      (pendingListRes.data ?? []) as Array<{
        id: string;
        code: string;
        first_name: string;
        last_name: string;
        pickup_date: string;
        pickup_time: string | null;
      }>
    ).map((row) => ({
      id: row.id,
      code: row.code,
      name: `${row.first_name} ${row.last_name}`.trim() || "Solicitante",
      pickupLabel: row.pickup_time
        ? `${row.pickup_date} ${row.pickup_time.slice(0, 5)}`
        : row.pickup_date,
      href: `/dashboard/solicitudes/${row.id}`,
    }));

    const reservationsToday = ((todayRes.data ?? []) as ReservationJoinRow[]).map(
      mapReservationAgendaItem,
    );
    const reservationsTomorrow = (
      (tomorrowRes.data ?? []) as ReservationJoinRow[]
    ).map(mapReservationAgendaItem);
    const deliveriesToday = (
      (deliveriesRes.data ?? []) as ReservationJoinRow[]
    ).map(mapReservationAgendaItem);
    const returnsToday = ((returnsRes.data ?? []) as ReservationJoinRow[]).map(
      mapReservationAgendaItem,
    );

    const openContracts = ((openContractsRes.data ?? []) as ContractJoinRow[]).map(
      (row) => mapOpenContract(row, nowIso),
    );
    const openContractAlerts = openContracts.filter((c) => c.isOverdue);

    return {
      configured: true,
      error: null,
      todayLabel: today.date,
      tomorrowLabel: tomorrow.date,
      pendingRequestsCount: pendingCountRes.count ?? pendingRequests.length,
      pendingRequests,
      reservationsToday,
      reservationsTomorrow,
      deliveriesToday,
      returnsToday,
      openContracts,
      openContractAlerts,
    };
  } catch (err) {
    return {
      ...empty,
      configured: true,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

/** Short time label for agenda rows (El Salvador). */
export function agendaTimeLabel(iso: string): string {
  return formatAppTime(iso);
}
