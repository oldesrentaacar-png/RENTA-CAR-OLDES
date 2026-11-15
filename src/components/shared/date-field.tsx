"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const MONTHS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
] as const;

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function parseIsoDate(value: string | null | undefined): {
  year: string;
  month: string;
  day: string;
} {
  const raw = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return { year: "", month: "", day: "" };
  return { year: match[1], month: match[2], day: match[3] };
}

type DateFieldProps = {
  name: string;
  label?: string;
  defaultValue?: string | null;
  required?: boolean;
  /** Inclusive. Birth dates: ~1930. License expiry: current year. */
  minYear?: number;
  /** Inclusive. Birth dates: current year. License expiry: +20. */
  maxYear?: number;
  className?: string;
  hint?: string;
};

/**
 * Day / month / year selects so staff can jump to 1976 without scrolling
 * month-by-month on the native mobile calendar.
 */
export function DateField({
  name,
  label,
  defaultValue,
  required,
  minYear = 1930,
  maxYear = new Date().getFullYear() + 20,
  className,
  hint = "Elija año, mes y día. Puede saltar directo al año (ej. 1976).",
}: DateFieldProps) {
  const initial = parseIsoDate(defaultValue);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) list.push(y);
    return list;
  }, [minYear, maxYear]);

  const maxDay = daysInMonth(Number(year) || 0, Number(month) || 0);
  const safeDay =
    day && Number(day) > maxDay ? String(maxDay).padStart(2, "0") : day;

  const iso =
    year && month && safeDay ? `${year}-${month}-${safeDay}` : "";

  const selectClass =
    "flex h-10 w-full rounded-lg border border-border bg-white px-2 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <label className="block text-sm font-medium text-foreground">
          {label}
          {required ? " *" : ""}
        </label>
      ) : null}
      <input type="hidden" name={name} value={iso} required={required && !iso} />
      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label="Año"
          className={selectClass}
          value={year}
          required={required}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">Año</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
        <select
          aria-label="Mes"
          className={selectClass}
          value={month}
          required={required}
          onChange={(e) => setMonth(e.target.value)}
        >
          <option value="">Mes</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Día"
          className={selectClass}
          value={safeDay}
          required={required}
          onChange={(e) => setDay(e.target.value)}
        >
          <option value="">Día</option>
          {Array.from({ length: maxDay }, (_, i) => {
            const d = String(i + 1).padStart(2, "0");
            return (
              <option key={d} value={d}>
                {i + 1}
              </option>
            );
          })}
        </select>
      </div>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
