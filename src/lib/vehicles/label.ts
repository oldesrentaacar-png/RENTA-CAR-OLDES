/**
 * Canonical vehicle display for lists, selects, calendar, contracts.
 * Plate first so identical year/model units stay distinguishable.
 */
export type VehicleLabelParts = {
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | string | null;
};

export function formatVehicleLabel(
  vehicle: VehicleLabelParts | null | undefined,
  options?: { includeRate?: number | null },
): string {
  if (!vehicle) return "Vehículo";
  const plate = String(vehicle.plate ?? "").trim() || "SIN-PLACA";
  const brand = String(vehicle.brand ?? "").trim();
  const model = String(vehicle.model ?? "").trim();
  const yearRaw = vehicle.year;
  const year =
    yearRaw === null || yearRaw === undefined || yearRaw === ""
      ? ""
      : String(yearRaw).trim();
  const name = [brand, model, year].filter(Boolean).join(" ").trim() || "Vehículo";
  const base = `${plate} · ${name}`;
  if (options?.includeRate != null && Number.isFinite(options.includeRate)) {
    return `${base} · $${Number(options.includeRate).toFixed(2)}/día`;
  }
  return base;
}

/** Two-line select display: plate on top, brand/model/year below. */
export function vehicleSelectParts(
  vehicle: VehicleLabelParts & { daily_rate?: number | null },
): { label: string; primary: string; secondary: string; searchText: string } {
  const plate = String(vehicle.plate ?? "").trim() || "SIN-PLACA";
  const brand = String(vehicle.brand ?? "").trim();
  const model = String(vehicle.model ?? "").trim();
  const year =
    vehicle.year === null || vehicle.year === undefined || vehicle.year === ""
      ? ""
      : String(vehicle.year).trim();
  const name = [brand, model, year].filter(Boolean).join(" ");
  const rate =
    vehicle.daily_rate != null && Number.isFinite(Number(vehicle.daily_rate))
      ? `$${Number(vehicle.daily_rate).toFixed(2)}/día`
      : "";
  const secondary = [name, rate].filter(Boolean).join(" · ");
  const label = formatVehicleLabel(vehicle, {
    includeRate: vehicle.daily_rate,
  });
  return {
    label,
    primary: plate,
    secondary,
    searchText: `${plate} ${brand} ${model} ${year}`,
  };
}
