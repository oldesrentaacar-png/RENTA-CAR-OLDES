import { createClient } from "@/lib/supabase/server";
import { mapPostgresError } from "@/lib/errors";
import type { Alert } from "@/types/database";

export type AlertForUser = Alert & {
  is_read: boolean;
  dismissed_at: string | null;
};

function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const msg = `${(error as { message?: string }).message ?? ""} ${(error as { code?: string }).code ?? ""}`.toLowerCase();
  return (
    msg.includes("alert_user_states") ||
    msg.includes("does not exist") ||
    msg.includes("42p01")
  );
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export async function loadAlertIdsDismissedByUser(
  supabase: SupabaseServer,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("alert_user_states")
    .select("alert_id")
    .eq("user_id", userId)
    .not("dismissed_at", "is", null);

  if (error) {
    if (isMissingRelation(error)) return new Set();
    throw mapPostgresError(error);
  }

  return new Set(
    ((data ?? []) as Array<{ alert_id: string }>).map((row) => row.alert_id),
  );
}

export async function loadAlertUserStatesMap(
  supabase: SupabaseServer,
  userId: string,
  alertIds: string[],
): Promise<Map<string, { read_at: string | null; dismissed_at: string | null }>> {
  const map = new Map<
    string,
    { read_at: string | null; dismissed_at: string | null }
  >();
  if (alertIds.length === 0) return map;

  const { data, error } = await supabase
    .from("alert_user_states")
    .select("alert_id, read_at, dismissed_at")
    .eq("user_id", userId)
    .in("alert_id", alertIds);

  if (error) {
    if (isMissingRelation(error)) return map;
    throw mapPostgresError(error);
  }

  for (const row of (data ?? []) as Array<{
    alert_id: string;
    read_at: string | null;
    dismissed_at: string | null;
  }>) {
    map.set(row.alert_id, {
      read_at: row.read_at,
      dismissed_at: row.dismissed_at,
    });
  }
  return map;
}

export function attachUserAlertState(
  alerts: Alert[],
  states: Map<string, { read_at: string | null; dismissed_at: string | null }>,
): AlertForUser[] {
  return alerts.map((alert) => {
    const state = states.get(alert.id);
    return {
      ...alert,
      is_read: Boolean(state?.read_at) || alert.is_read,
      dismissed_at: state?.dismissed_at ?? null,
    };
  });
}

export async function upsertAlertUserState(
  supabase: SupabaseServer,
  input: {
    alertId: string;
    userId: string;
    read?: boolean;
    dismiss?: boolean;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    alert_id: input.alertId,
    user_id: input.userId,
    updated_at: now,
  };
  if (input.read) patch.read_at = now;
  if (input.dismiss) {
    patch.dismissed_at = now;
    patch.read_at = now;
  }

  const { error } = await supabase.from("alert_user_states").upsert(patch, {
    onConflict: "alert_id,user_id",
  });

  if (error) {
    if (isMissingRelation(error)) {
      throw new Error(
        "Falta aplicar la migración de avisos por usuario (alert_user_states).",
      );
    }
    throw mapPostgresError(error);
  }
}
