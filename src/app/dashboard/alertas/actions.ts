"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { generateAlerts } from "@/lib/alerts/generate";
import {
  attachUserAlertState,
  loadAlertIdsDismissedByUser,
  loadAlertUserStatesMap,
  upsertAlertUserState,
  type AlertForUser,
} from "@/lib/alerts/user-state";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Alert } from "@/types/database";

async function listActiveAlertsForUser(
  userId: string,
  limit?: number,
): Promise<{ alerts: AlertForUser[]; total: number }> {
  const supabase = await createClient();
  await generateAlerts();

  let query = supabase
    .from("alerts")
    .select("*")
    .eq("is_active", true)
    .order("due_at", { ascending: true, nullsFirst: false });

  if (limit != null) {
    // Fetch extra so dismissals for this user still leave a full page.
    query = query.limit(Math.max(limit * 4, 40));
  } else {
    query = query.limit(200);
  }

  const { data, error } = await query;
  if (error) throw mapPostgresError(error);

  const all = (data ?? []) as Alert[];
  const dismissed = await loadAlertIdsDismissedByUser(supabase, userId);
  const visible = all.filter((alert) => !dismissed.has(alert.id));
  const page = limit != null ? visible.slice(0, limit) : visible;
  const states = await loadAlertUserStatesMap(
    supabase,
    userId,
    page.map((a) => a.id),
  );

  return {
    alerts: attachUserAlertState(page, states),
    total: visible.length,
  };
}

export async function fetchActiveAlerts(limit = 10): Promise<
  ActionResult<{ alerts: AlertForUser[]; total: number }>
> {
  try {
    const { user } = await assertPermission("dashboard.view");
    if (!isSupabaseConfigured()) {
      return actionSuccess({ alerts: [], total: 0 });
    }

    const result = await listActiveAlertsForUser(user.id, limit);
    return actionSuccess(result);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listAlerts(
  includeResolved = false,
): Promise<ActionResult<AlertForUser[]>> {
  try {
    const { user } = await assertPermission("dashboard.view");
    if (!isSupabaseConfigured()) {
      return actionSuccess([]);
    }

    if (includeResolved) {
      const supabase = await createClient();
      await generateAlerts();
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw mapPostgresError(error);
      const all = (data ?? []) as Alert[];
      const states = await loadAlertUserStatesMap(
        supabase,
        user.id,
        all.map((a) => a.id),
      );
      return actionSuccess(attachUserAlertState(all, states));
    }

    const result = await listActiveAlertsForUser(user.id);
    return actionSuccess(result.alerts);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

/** Marca leída solo para el usuario actual (no afecta a otros perfiles). */
export async function markAlertRead(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("dashboard.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    await upsertAlertUserState(supabase, {
      alertId: id,
      userId: user.id,
      read: true,
    });

    await writeAuditLog({
      userId: user.id,
      action: "alert.read",
      entityType: "alert",
      entityId: id,
    });

    revalidatePath("/dashboard/alertas");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

/**
 * Quita el aviso de la campanita del usuario actual.
 * No lo borra del sistema ni lo quita a otros perfiles.
 */
export async function dismissAlertForMe(
  id: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("dashboard.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    await upsertAlertUserState(supabase, {
      alertId: id,
      userId: user.id,
      dismiss: true,
      read: true,
    });

    await writeAuditLog({
      userId: user.id,
      action: "alert.dismiss",
      entityType: "alert",
      entityId: id,
      metadata: { scope: "user" },
    });

    revalidatePath("/dashboard/alertas");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

/** Compat: "Resolver" en UI ahora = quitar de mis avisos. */
export async function resolveAlert(id: string): Promise<ActionResult<void>> {
  return dismissAlertForMe(id);
}

export async function dismissAllAlertsForMe(): Promise<
  ActionResult<{ dismissed: number }>
> {
  try {
    const { user } = await assertPermission("dashboard.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("alerts")
      .select("id")
      .eq("is_active", true)
      .limit(200);
    if (error) throw mapPostgresError(error);

    const dismissedIds = await loadAlertIdsDismissedByUser(supabase, user.id);
    const pending = ((data ?? []) as Array<{ id: string }>).filter(
      (row) => !dismissedIds.has(row.id),
    );

    for (const row of pending) {
      await upsertAlertUserState(supabase, {
        alertId: row.id,
        userId: user.id,
        dismiss: true,
        read: true,
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: "alert.dismiss_all",
      entityType: "alert",
      entityId: null,
      metadata: { count: pending.length, scope: "user" },
    });

    revalidatePath("/dashboard/alertas");
    return actionSuccess({ dismissed: pending.length });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function refreshAlerts(): Promise<
  ActionResult<{ created: number; resolved: number }>
> {
  try {
    await assertPermission("dashboard.view");
    const result = await generateAlerts();
    if (result.error) {
      return actionError(result.error);
    }
    revalidatePath("/dashboard/alertas");
    return actionSuccess({ created: result.created, resolved: result.resolved });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
