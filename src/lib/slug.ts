const SLUG_SEPARATOR = "-";

function normalizeSlugPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, SLUG_SEPARATOR)
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, SLUG_SEPARATOR);
}

export function slugify(value: string): string {
  return normalizeSlugPart(value);
}

export function slugifyVehicle(
  brand: string,
  model: string,
  year: number,
  plate?: string,
): string {
  const parts = [
    normalizeSlugPart(brand),
    normalizeSlugPart(model),
    String(year),
  ];

  if (plate) {
    parts.push(normalizeSlugPart(plate));
  }

  return parts.filter(Boolean).join(SLUG_SEPARATOR);
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
