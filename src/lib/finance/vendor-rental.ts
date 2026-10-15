import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { APP_TIMEZONE } from "@/lib/dates";

export function normalizePersonName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Match a vehicle owner name to one active vendor. Ambiguous names stay unmatched. */
export function matchVendorIdByName(
  payeeName: string | null | undefined,
  vendors: Array<{ id: string; name: string }>,
): string | null {
  const target = normalizePersonName(payeeName ?? "");
  if (!target) return null;

  const exact = vendors.find(
    (vendor) => normalizePersonName(vendor.name) === target,
  );
  if (exact) return exact.id;

  const contained = vendors.filter((vendor) => {
    const name = normalizePersonName(vendor.name);
    return name.length > 0 && (name.includes(target) || target.includes(name));
  });
  return contained.length === 1 ? contained[0].id : null;
}

export function formatRentalDate(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatInTimeZone(parsed, APP_TIMEZONE, "dd/MM/yyyy");
}

export function buildVendorRentalConcept(input: {
  contractCode?: string | null;
  vehicleLabel?: string | null;
  plate?: string | null;
  rentalDays?: number | null;
  startAt?: string | null;
  endAt?: string | null;
}): string {
  const plate = input.plate?.trim() ?? "";
  const label = input.vehicleLabel?.trim() ?? "";
  const vehicle =
    plate && label.toLowerCase().includes(plate.toLowerCase())
      ? label
      : [label, plate].filter(Boolean).join(" ");
  const start = formatRentalDate(input.startAt);
  const end = formatRentalDate(input.endAt);
  const period = start && end ? `${start}–${end}` : start ?? end;
  const days =
    input.rentalDays && input.rentalDays > 0 ? `${input.rentalDays} días` : null;
  const text = [input.contractCode, vehicle, days, period].filter(Boolean).join(" · ");
  return text.slice(0, 400);
}
