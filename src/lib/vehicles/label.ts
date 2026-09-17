/**
 * Canonical vehicle display for lists, selects, calendar, contracts.
 * Ops focus: modelo (+ año) + placa — brand is secondary for staff.
 */
export type VehicleLabelParts = {
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | string | null;
};

function plateOf(vehicle: VehicleLabelParts): string {
  return String(vehicle.plate ?? "").trim() || "SIN-PLACA";
}

function modelYearOf(vehicle: VehicleLabelParts): string {
  const model = String(vehicle.model ?? "").trim();
  const yearRaw = vehicle.year;
  const year =
    yearRaw === null || yearRaw === undefined || yearRaw === ""
      ? ""
      : String(yearRaw).trim();
  return [model, year].filter(Boolean).join(" ").trim();
}

/**
 * Staff label: "Rogue 2019 · P123-456" (modelo + placa).
 * Brand omitted by default — client prefers model+plate to tell units apart.
 */
export function formatVehicleLabel(
  vehicle: VehicleLabelParts | null | undefined,
  options?: { includeRate?: number | null; includeBrand?: boolean },
): string {
  if (!vehicle) return "Vehículo";
  const plate = plateOf(vehicle);
  const brand = String(vehicle.brand ?? "").trim();
  const modelYear = modelYearOf(vehicle);
  const name = options?.includeBrand
    ? [brand, modelYear].filter(Boolean).join(" ").trim()
    : modelYear || brand || "Vehículo";
  const base = `${name || "Vehículo"} · ${plate}`;
  if (options?.includeRate != null && Number.isFinite(options.includeRate)) {
    return `${base} · $${Number(options.includeRate).toFixed(2)}/día`;
  }
  return base;
}

/** Two-line select: placa arriba, modelo (+año) abajo — legible en tablet. */
export function vehicleSelectParts(
  vehicle: VehicleLabelParts & { daily_rate?: number | null },
): { label: string; primary: string; secondary: string; searchText: string } {
  const plate = plateOf(vehicle);
  const brand = String(vehicle.brand ?? "").trim();
  const model = String(vehicle.model ?? "").trim();
  const year =
    vehicle.year === null || vehicle.year === undefined || vehicle.year === ""
      ? ""
      : String(vehicle.year).trim();
  const modelYear = [model, year].filter(Boolean).join(" ");
  const rate =
    vehicle.daily_rate != null && Number.isFinite(Number(vehicle.daily_rate))
      ? `$${Number(vehicle.daily_rate).toFixed(2)}/día`
      : "";
  const secondary = [modelYear || brand || "Vehículo", rate]
    .filter(Boolean)
    .join(" · ");
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
