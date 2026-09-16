import { normalizePhoneForWhatsApp } from "@/lib/whatsapp";

/** Active alert window for pending web quote requests. */
export const WEB_REQUEST_ALERT_TTL_HOURS = 72;

export function webRequestAlertWindowStart(now: Date = new Date()): Date {
  return new Date(
    now.getTime() - WEB_REQUEST_ALERT_TTL_HOURS * 60 * 60 * 1000,
  );
}

export function normalizeRequestPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return "";
  return normalizePhoneForWhatsApp(phone);
}

export type RecentWebRequestRef = {
  id: string;
  code: string;
  status: string;
  phone: string;
  email?: string | null;
  created_at: string;
  first_name?: string;
  last_name?: string;
};

/** Other requests from the same phone inside the TTL window. */
export function findRelatedRequestsInWindow(
  current: Pick<RecentWebRequestRef, "id" | "phone">,
  pool: RecentWebRequestRef[],
): RecentWebRequestRef[] {
  const key = normalizeRequestPhone(current.phone);
  if (!key) return [];

  return pool
    .filter((row) => row.id !== current.id)
    .filter((row) => normalizeRequestPhone(row.phone) === key)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

export function formatRelatedRequestsNote(
  related: RecentWebRequestRef[],
): string | null {
  if (related.length === 0) return null;

  const bits = related.slice(0, 3).map((row) => {
    const status = String(row.status || "").toUpperCase();
    const label =
      status === "REJECTED"
        ? "rechazada"
        : status === "CANCELLED"
          ? "cancelada"
          : status === "CONVERTED"
            ? "convertida"
            : status === "QUOTED"
              ? "cotizada"
              : status === "CONTACTED"
                ? "contactada"
                : "pendiente";
    return `${row.code} (${label})`;
  });

  const more =
    related.length > 3 ? ` +${related.length - 3} más` : "";

  return `Reincidente en ${WEB_REQUEST_ALERT_TTL_HOURS}h: ${bits.join(", ")}${more}`;
}
