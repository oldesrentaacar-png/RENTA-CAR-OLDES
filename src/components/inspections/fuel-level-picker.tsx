"use client";

import { useState } from "react";

import { FUEL_GAUGE_MARKS, FUEL_LEVEL_ORDER } from "@/lib/inspections/defaults";
import { cn } from "@/lib/utils";
import type { FuelLevel } from "@/types/database";

type FuelLevelPickerProps = {
  name?: string;
  defaultValue?: string;
  label?: string;
};

/**
 * Selector visual de tanque por fracciones (E … F), no porcentaje.
 */
export function FuelLevelPicker({
  name = "fuelLevel",
  defaultValue = "",
  label = "Nivel de combustible (tanque)",
}: FuelLevelPickerProps) {
  const [selected, setSelected] = useState(defaultValue);

  return (
    <fieldset className="space-y-2">
      {label ? (
        <legend className="text-sm font-medium text-foreground">{label}</legend>
      ) : null}
      <input type="hidden" name={name} value={selected} />
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
        Terminología de tanque: vacío → 1/8 → … → lleno (no porcentaje).
      </p>
    </fieldset>
  );
}
