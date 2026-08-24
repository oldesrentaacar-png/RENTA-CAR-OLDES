"use client";

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type CalendarReservation = {
  id: string;
  code: string;
  status: string;
  start_at: string;
  end_at: string;
  vehicle_id: string;
  vehicleLabel: string;
  customerName: string;
};

type CalendarViewProps = {
  reservations: CalendarReservation[];
  vehicles: Array<{ id: string; label: string }>;
};

type ViewMode = "month" | "week" | "day";

const WEEK_STARTS_ON = 1 as const;
const MAX_VISIBLE_LANES = 3;
const LANE_HEIGHT = 18;
const LANE_GAP = 2;
const DAY_NUMBER_HEIGHT = 22;

const WEEKDAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

type PlacedBar = {
  reservation: CalendarReservation;
  lane: number;
  startCol: number;
  span: number;
};

function statusBarClass(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800 hover:bg-blue-200";
    case "ACTIVE":
      return "bg-green-100 text-green-800 hover:bg-green-200";
    case "COMPLETED":
      return "bg-slate-100 text-slate-600 hover:bg-slate-200";
    case "CANCELLED":
      return "bg-red-50 text-red-700/70 hover:bg-red-100";
    default:
      return "bg-brand-light text-brand hover:bg-brand-light/80";
  }
}

function formatEventTime(iso: string): string | null {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return format(d, "HH:mm");
}

function eventLabel(r: CalendarReservation): string {
  const time = formatEventTime(r.start_at);
  return [time, r.vehicleLabel, r.customerName].filter(Boolean).join(" · ");
}

function reservationTouchesDay(r: CalendarReservation, day: Date) {
  const start = startOfDay(parseISO(r.start_at));
  const end = startOfDay(parseISO(r.end_at));
  const d = startOfDay(day);
  return d >= start && d <= end;
}

function layoutWeekBars(
  events: CalendarReservation[],
  weekDays: Date[],
): { bars: PlacedBar[]; overflowByDay: number[] } {
  const weekStart = startOfDay(weekDays[0]);
  const weekEnd = startOfDay(weekDays[6]);

  const candidates = events
    .map((reservation) => {
      const start = startOfDay(parseISO(reservation.start_at));
      const end = startOfDay(parseISO(reservation.end_at));
      if (end < weekStart || start > weekEnd) return null;

      const clippedStart = start < weekStart ? weekStart : start;
      const clippedEnd = end > weekEnd ? weekEnd : end;
      const startCol = differenceInCalendarDays(clippedStart, weekStart);
      const endCol = differenceInCalendarDays(clippedEnd, weekStart);

      return {
        reservation,
        startCol,
        span: endCol - startCol + 1,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      if (a.startCol !== b.startCol) return a.startCol - b.startCol;
      return b.span - a.span;
    });

  const laneEnds: number[] = [];
  const placed: PlacedBar[] = [];

  for (const item of candidates) {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] > item.startCol) {
      lane += 1;
    }
    if (lane === laneEnds.length) laneEnds.push(0);
    laneEnds[lane] = item.startCol + item.span;
    placed.push({
      reservation: item.reservation,
      lane,
      startCol: item.startCol,
      span: item.span,
    });
  }

  const overflowByDay = weekDays.map((_, dayIndex) =>
    placed.filter(
      (p) =>
        p.lane >= MAX_VISIBLE_LANES &&
        dayIndex >= p.startCol &&
        dayIndex < p.startCol + p.span,
    ).length,
  );

  return {
    bars: placed.filter((p) => p.lane < MAX_VISIBLE_LANES),
    overflowByDay,
  };
}

export function ReservationCalendar({ reservations, vehicles }: CalendarViewProps) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (vehicleFilter && r.vehicle_id !== vehicleFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (q) {
        const haystack = `${r.customerName} ${r.vehicleLabel} ${r.code}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [reservations, vehicleFilter, statusFilter, search]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });
  const monthDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < monthDays.length; i += 7) {
      rows.push(monthDays.slice(i, i + 7));
    }
    return rows;
  }, [monthDays]);

  const weekStart = startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  function reservationsForDay(day: Date) {
    return filtered.filter((r) => reservationTouchesDay(r, day));
  }

  const today = startOfDay(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex gap-1 rounded-lg bg-surface-muted p-1">
          {(["month", "week", "day"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize",
                view === mode ? "bg-white shadow-sm" : "text-muted",
              )}
            >
              {mode === "month" ? "Mes" : mode === "week" ? "Semana" : "Día"}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
          onClick={() => setCursor(new Date())}
        >
          Hoy
        </button>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
          onClick={() =>
            setCursor((d) =>
              view === "month"
                ? new Date(d.getFullYear(), d.getMonth() - 1, 1)
                : addDays(d, view === "week" ? -7 : -1),
            )
          }
        >
          ←
        </button>
        <span className="min-w-[160px] text-center text-sm font-medium capitalize">
          {format(cursor, view === "day" ? "PPP" : "MMMM yyyy", { locale: es })}
        </span>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
          onClick={() =>
            setCursor((d) =>
              view === "month"
                ? new Date(d.getFullYear(), d.getMonth() + 1, 1)
                : addDays(d, view === "week" ? 7 : 1),
            )
          }
        >
          →
        </button>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente, vehículo o código"
          className="min-w-[220px] flex-1 rounded-lg border border-border px-3 py-1.5 text-sm"
        />
        <select
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          <option value="">Todos los vehículos</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="CONFIRMED">Confirmada</option>
          <option value="ACTIVE">Activa</option>
          <option value="COMPLETED">Completada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
          onClick={() => router.refresh()}
        >
          Actualizar
        </button>
      </div>

      {view === "month" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-7 border-b border-border bg-surface-muted text-center text-xs font-semibold uppercase text-muted">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="px-2 py-2">
                {d}
              </div>
            ))}
          </div>
          <div>
            {weeks.map((days) => {
              const { bars, overflowByDay } = layoutWeekBars(filtered, days);
              const contentHeight =
                DAY_NUMBER_HEIGHT +
                MAX_VISIBLE_LANES * (LANE_HEIGHT + LANE_GAP) +
                18;

              return (
                <div
                  key={days[0].toISOString()}
                  className="relative grid grid-cols-7 border-b border-border last:border-b-0"
                  style={{ minHeight: contentHeight }}
                >
                  {days.map((day, dayIndex) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "border-r border-border p-1 last:border-r-0",
                        !isSameMonth(day, cursor) && "bg-surface-muted/40 text-muted",
                        isSameDay(day, today) && "bg-brand-light/30",
                      )}
                    >
                      <div
                        className={cn(
                          "text-xs font-medium",
                          isSameDay(day, today) && "text-brand",
                        )}
                        style={{ height: DAY_NUMBER_HEIGHT }}
                      >
                        {format(day, "d")}
                      </div>
                      <div
                        aria-hidden
                        style={{
                          height: MAX_VISIBLE_LANES * (LANE_HEIGHT + LANE_GAP),
                        }}
                      />
                      {overflowByDay[dayIndex] > 0 ? (
                        <span className="block px-0.5 text-[10px] text-muted">
                          +{overflowByDay[dayIndex]} más
                        </span>
                      ) : null}
                    </div>
                  ))}

                  <div
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: DAY_NUMBER_HEIGHT + 4 }}
                  >
                    {bars.map((bar) => (
                      <Link
                        key={`${bar.reservation.id}-${bar.startCol}`}
                        href={`/dashboard/reservas/${bar.reservation.id}`}
                        title={`${bar.reservation.code} — ${eventLabel(bar.reservation)}`}
                        className={cn(
                          "pointer-events-auto absolute truncate rounded px-1 text-[10px] font-medium leading-[18px]",
                          statusBarClass(bar.reservation.status),
                        )}
                        style={{
                          left: `calc(${(bar.startCol / 7) * 100}% + 2px)`,
                          width: `calc(${(bar.span / 7) * 100}% - 4px)`,
                          top: bar.lane * (LANE_HEIGHT + LANE_GAP),
                          height: LANE_HEIGHT,
                        }}
                      >
                        {eventLabel(bar.reservation)}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "week" ? (
        <div className="grid gap-3 md:grid-cols-7">
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium capitalize">
                {format(day, "EEE d", { locale: es })}
              </p>
              <div className="mt-2 space-y-1">
                {reservationsForDay(day).map((r) => (
                  <Link
                    key={r.id}
                    href={`/dashboard/reservas/${r.id}`}
                    className={cn(
                      "block truncate rounded px-2 py-1 text-xs font-medium",
                      statusBarClass(r.status),
                    )}
                    title={`${r.code} — ${eventLabel(r)}`}
                  >
                    {eventLabel(r)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {view === "day" ? (
        <div className="rounded-xl border border-border p-4">
          <h3 className="font-medium capitalize">
            {format(cursor, "PPPP", { locale: es })}
          </h3>
          <div className="mt-4 space-y-2">
            {reservationsForDay(cursor).length === 0 ? (
              <p className="text-sm text-muted">Sin reservas este día.</p>
            ) : (
              reservationsForDay(cursor).map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/reservas/${r.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-4 py-3 hover:bg-surface-muted"
                >
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-medium",
                      statusBarClass(r.status),
                    )}
                  >
                    {r.status}
                  </span>
                  <span className="font-medium">{r.code}</span>
                  <span className="text-sm text-muted">{eventLabel(r)}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
