"use client";

import { useState } from "react";

import {
  FUEL_GAUGE_MARKS,
  FUEL_LEVEL_ORDER,
  fuelLevelIndex,
} from "@/lib/inspections/defaults";
import { cn } from "@/lib/utils";
import type { FuelLevel } from "@/types/database";

type FuelLevelPickerProps = {
  name?: string;
  defaultValue?: string;
  label?: string;
};

/**
 * Medidor de tanque con aguja (E … F) — misma escala de 9 niveles.
 */
export function FuelLevelPicker({
  name = "fuelLevel",
  defaultValue = "",
  label = "Nivel de combustible (tanque)",
}: FuelLevelPickerProps) {
  const [selected, setSelected] = useState(defaultValue);
  const activeIndex = fuelLevelIndex(selected);

  const width = 280;
  const height = 150;
  const cx = width / 2;
  const cy = height - 18;
  const r = 110;
  const angleFor = (index: number) => Math.PI - (index / 8) * Math.PI;
  const needleAngle = activeIndex >= 0 ? angleFor(activeIndex) : Math.PI / 2;
  const nx = cx + Math.cos(needleAngle) * (r - 18);
  const ny = cy - Math.sin(needleAngle) * (r - 18);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <fieldset className="space-y-3">
      {label ? (
        <legend className="text-sm font-medium text-foreground">{label}</legend>
      ) : null}
      <input type="hidden" name={name} value={selected} />

      <div className="rounded-xl border border-border bg-white px-3 py-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto h-36 w-full max-w-sm"
          role="img"
          aria-label={
            activeIndex >= 0
              ? `Combustible en ${FUEL_GAUGE_MARKS[activeIndex]}`
              : "Seleccione nivel de combustible"
          }
        >
          <path
            d={arc}
            fill="none"
            stroke="#0f2744"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {FUEL_LEVEL_ORDER.map((_, index) => {
            const a = angleFor(index);
            const x1 = cx + Math.cos(a) * (r - 2);
            const y1 = cy - Math.sin(a) * (r - 2);
            const x2 = cx + Math.cos(a) * (r - 14);
            const y2 = cy - Math.sin(a) * (r - 14);
            const active = index === activeIndex;
            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={active ? "#c45c26" : "#94a3b8"}
                strokeWidth={active ? 3 : 1.5}
              />
            );
          })}
          <text x={cx - r - 4} y={cy + 16} fontSize="14" fill="#64748b">
            E
          </text>
          <text x={cx + r - 8} y={cy + 16} fontSize="14" fill="#64748b">
            F
          </text>
          {activeIndex >= 0 ? (
            <>
              <line
                x1={cx}
                y1={cy}
                x2={nx}
                y2={ny}
                stroke="#c45c26"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx={cx} cy={cy} r="6" fill="#0f2744" />
              <text
                x={cx}
                y={cy - 36}
                textAnchor="middle"
                fontSize="18"
                fontWeight="700"
                fill="#0f2744"
              >
                {FUEL_GAUGE_MARKS[activeIndex]}
              </text>
            </>
          ) : (
            <text
              x={cx}
              y={cy - 36}
              textAnchor="middle"
              fontSize="12"
              fill="#94a3b8"
            >
              Toque un nivel
            </text>
          )}
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
        {FUEL_LEVEL_ORDER.map((level, index) => {
          const active = selected === level;
          return (
            <button
              key={level}
              type="button"
              onClick={() => setSelected(level as FuelLevel)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-lg border-2 px-1 py-2 text-xs font-bold touch-manipulation",
                active
                  ? "border-brand bg-brand-light text-brand-dark"
                  : "border-border bg-white text-muted hover:border-brand/40",
              )}
            >
              <span className="text-sm leading-none">
                {FUEL_GAUGE_MARKS[index]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        La aguja marca el nivel que usted selecciona (vacío → lleno).
      </p>
    </fieldset>
  );
}
