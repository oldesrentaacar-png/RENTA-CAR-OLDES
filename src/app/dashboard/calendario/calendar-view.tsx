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

import {
  CALENDAR_PHASE_LABELS,
  calendarPhaseBarClass,
  type CalendarPhase,
} from "@/lib/calendar/phase";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";

export type CalendarReservation = {
  id: string;
  code: string;
  status: string;
  start_at: string;
  end_at: string;
  vehicle_id: string;
  vehicleLabel: string;
  customerName: string;
  phase: CalendarPhase;
  contractId?: string | null;
  contractCode?: string | null;
  hasCheckOut?: boolean;
};

type CalendarViewProps = {
  reservations: CalendarReservation[];
  vehicles: Array<{
    id: string;
    label: string;
    primary?: string;
    secondary?: string;
    searchText?: string;
  }>;
};

type ViewMode = "month" | "week" | "day";

const WEEK_STARTS_ON = 1 as const;
const MAX_VISIBLE_LANES = 3;
const LANE_HEIGHT = 18;
const LANE_GAP = 2;
const DAY_NUMBER_HEIGHT = 22;

const WEEKDAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

const PHASE_FILTER_OPTIONS: Array<{ value: CalendarPhase | ""; label: string }> =
  [
    { value: "", label: "Todos los estados" },
    { value: "SIN_CONTRATO", label: CALENDAR_PHASE_LABELS.SIN_CONTRATO },
    {
      value: "PENDIENTE_ENTREGA",
      label: CALENDAR_PHASE_LABELS.PENDIENTE_ENTREGA,
    },
    { value: "EN_CURSO", label: CALENDAR_PHASE_LABELS.EN_CURSO },
    { value: "FINALIZADA", label: CALENDAR_PHASE_LABELS.FINALIZADA },
    { value: "ANULADA", label: CALENDAR_PHASE_LABELS.ANULADA },
  ];

type PlacedBar = {
  reservation: CalendarReservation;
  lane: number;
  startCol: number;
  span: number;
};

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

/** Contract is operational source of truth once it exists. */
function eventHref(r: CalendarReservation): string {
  return r.contractId
    ? `/dashboard/contratos/${r.contractId}`
    : `/dashboard/reservas/${r.id}`;
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
  const [phaseFilter, setPhaseFilter] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (vehicleFilter && r.vehicle_id !== vehicleFilter) return false;
      if (phaseFilter && r.phase !== phaseFilter) return false;
      if (q) {
        const haystack =
          `${r.customerName} ${r.vehicleLabel} ${r.code} ${r.contractCode ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [reservations, vehicleFilter, phaseFilter, search]);

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

  function openDay(day: Date) {
    setCursor(startOfDay(day));
    setView("day");
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
          onClick={() => {
            setCursor(new Date());
            setView("day");
          }}
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
        <SearchableSelect
          value={vehicleFilter}
          onChange={setVehicleFilter}
          placeholder="Todos los vehículos"
          searchPlaceholder="Buscar vehículo…"
          className="min-w-[12rem]"
          options={[
            { value: "", label: "Todos los vehículos" },
            ...vehicles.map((v) => ({
              value: v.id,
              label: v.label,
              primary: v.primary,
              secondary: v.secondary,
              searchText: v.searchText,
            })),
          ]}
        />
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          {PHASE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
          onClick={() => router.refresh()}
        >
          Actualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-muted">
        {(
          [
            "SIN_CONTRATO",
            "PENDIENTE_ENTREGA",
            "EN_CURSO",
            "FINALIZADA",
            "ANULADA",
          ] as CalendarPhase[]
        ).map((phase) => (
          <span
            key={phase}
            className={cn(
              "rounded px-2 py-0.5 font-medium",
              calendarPhaseBarClass(phase),
            )}
          >
            {CALENDAR_PHASE_LABELS[phase]}
          </span>
        ))}
        <span className="self-center">
          En vista mes: clic en el día o en “+N más” para ver todas las reservas
          de ese día.
        </span>
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
                  {days.map((day, dayIndex) => {
                    const dayCount = reservationsForDay(day).length;
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => openDay(day)}
                        title={
                          dayCount > 0
                            ? `Ver ${dayCount} reserva(s) del ${format(day, "d MMM", { locale: es })}`
                            : `Abrir ${format(day, "d MMM", { locale: es })}`
                        }
                        className={cn(
                          "border-r border-border p-1 text-left last:border-r-0 hover:bg-brand-light/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
                          !isSameMonth(day, cursor) &&
                            "bg-surface-muted/40 text-muted",
                          isSameDay(day, today) && "bg-brand-light/30",
                        )}
                      >
                        <div
                          className={cn(
                            "text-xs font-medium underline-offset-2",
                            isSameDay(day, today) && "text-brand",
                            dayCount > 0 && "underline decoration-dotted",
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
                          <span className="block px-0.5 text-[10px] font-medium text-brand">
                            +{overflowByDay[dayIndex]} más · ver día
                          </span>
                        ) : null}
                      </button>
                    );
                  })}

                  <div
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: DAY_NUMBER_HEIGHT + 4 }}
                  >
                    {bars.map((bar) => (
                      <Link
                        key={`${bar.reservation.id}-${bar.startCol}`}
                        href={eventHref(bar.reservation)}
                        title={`${bar.reservation.contractCode ? `Contrato ${bar.reservation.contractCode}` : bar.reservation.code} — ${CALENDAR_PHASE_LABELS[bar.reservation.phase]} — ${eventLabel(bar.reservation)}`}
                        className={cn(
                          "pointer-events-auto absolute truncate rounded px-1 text-[10px] font-medium leading-[18px]",
                          calendarPhaseBarClass(bar.reservation.phase),
                        )}
                        style={{
                          left: `calc(${(bar.startCol / 7) * 100}% + 2px)`,
                          width: `calc(${(bar.span / 7) * 100}% - 4px)`,
                          top: bar.lane * (LANE_HEIGHT + LANE_GAP),
                          height: LANE_HEIGHT,
                        }}
                        onClick={(e) => e.stopPropagation()}
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
              <button
                type="button"
                onClick={() => openDay(day)}
                className="w-full text-left text-sm font-medium capitalize hover:text-brand"
                title="Ver día completo"
              >
                {format(day, "EEE d", { locale: es })}
              </button>
              <div className="mt-2 space-y-1">
                {reservationsForDay(day).map((r) => (
                  <Link
                    key={r.id}
                    href={eventHref(r)}
                    className={cn(
                      "block truncate rounded px-2 py-1 text-xs font-medium",
                      calendarPhaseBarClass(r.phase),
                    )}
                    title={`${r.contractCode ? `Contrato ${r.contractCode}` : r.code} — ${CALENDAR_PHASE_LABELS[r.phase]} — ${eventLabel(r)}`}
                  >
                    <span className="mr-1 opacity-80">
                      {CALENDAR_PHASE_LABELS[r.phase]}
                    </span>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium capitalize">
              {format(cursor, "PPPP", { locale: es })}
            </h3>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 text-sm"
              onClick={() => setView("month")}
            >
              Volver al mes
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {reservationsForDay(cursor).length === 0 ? (
              <p className="text-sm text-muted">Sin reservas este día.</p>
            ) : (
              reservationsForDay(cursor).map((r) => (
                <Link
                  key={r.id}
                  href={eventHref(r)}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-4 py-3 hover:bg-surface-muted"
                >
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-medium",
                      calendarPhaseBarClass(r.phase),
                    )}
                  >
                    {CALENDAR_PHASE_LABELS[r.phase]}
                  </span>
                  <span className="font-medium">{r.code}</span>
                  {r.contractCode ? (
                    <span className="text-xs text-muted">
                      Contrato {r.contractCode}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Sin contrato</span>
                  )}
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
