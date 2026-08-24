const HTML_TAG_REGEX = /<[^>]*>/g;
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;
const MULTI_SPACE_REGEX = /\s{2,}/g;

export function sanitizeString(
  value: string,
  maxLength: number = 5000,
): string {
  return value
    .replace(HTML_TAG_REGEX, "")
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(MULTI_SPACE_REGEX, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeOptionalString(
  value: string | undefined | null,
  maxLength: number = 5000,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const sanitized = sanitizeString(value, maxLength);
  return sanitized.length > 0 ? sanitized : undefined;
}

export function sanitizePhone(value: string): string {
  return value.replace(/[^\d+\-\s()]/g, "").trim().slice(0, 20);
}

export function sanitizeEmail(value: string): string {
  return sanitizeString(value, 254).toLowerCase();
}

export function sanitizeRecord<T extends Record<string, unknown>>(
  input: T,
  stringFields: Array<keyof T & string>,
  maxLength: number = 5000,
): T {
  const output = { ...input };

  for (const field of stringFields) {
    const value = output[field];
    if (typeof value === "string") {
      output[field] = sanitizeString(value, maxLength) as T[keyof T & string];
    }
  }

  return output;
}

export function stripNullBytes(value: string): string {
  return value.replace(/\0/g, "");
}
