"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { generateAlerts } from "@/lib/alerts/generate";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Alert } from "@/types/database";

export async function fetchActiveAlerts(limit = 10): Promise<
  ActionResult<{ alerts: Alert[]; total: number }>
> {
  try {
    await assertPermission("dashboard.view");
    if (!isSupabaseConfigured()) {
      return actionSuccess({ alerts: [], total: 0 });
    }

    await generateAlerts();

    const supabase = await createClient();
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from("alerts")
        .select("*")
        .eq("is_active", true)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(limit),
      supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    if (error) throw mapPostgresError(error);
    if (countError) throw mapPostgresError(countError);

    return actionSuccess({
      alerts: (data ?? []) as Alert[],
      total: count ?? 0,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listAlerts(
  includeResolved = false,
): Promise<ActionResult<Alert[]>> {
  try {
    await assertPermission("dashboard.view");
    if (!isSupabaseConfigured()) {
      return actionSuccess([]);
    }

    await generateAlerts();

    const supabase = await createClient();
    let query = supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!includeResolved) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw mapPostgresError(error);

    return actionSuccess((data ?? []) as Alert[]);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function markAlertRead(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("dashboard.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("alerts")
      .update({ is_read: true })
      .eq("id", id);

    if (error) throw mapPostgresError(error);

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

export async function resolveAlert(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("dashboard.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("alerts")
      .update({
        is_active: false,
        is_read: true,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "alert.resolve",
      entityType: "alert",
      entityId: id,
    });

    revalidatePath("/dashboard/alertas");
    return actionSuccess(undefined as void);
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
