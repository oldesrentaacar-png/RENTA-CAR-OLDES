import { NextResponse } from "next/server";

import { generateAlerts } from "@/lib/alerts/generate";
import {
  attachUserAlertState,
  loadAlertIdsDismissedByUser,
  loadAlertUserStatesMap,
} from "@/lib/alerts/user-state";
import { createClient } from "@/lib/supabase/server";
import type { Alert } from "@/types/database";

/**
 * Lightweight alert summary for the OLDES Android app (cookie session).
 * Used by background polling to show native notifications.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    await generateAlerts();

    const { data, error } = await supabase
      .from("alerts")
      .select("id, title, message, severity, alert_type, due_at, created_at")
      .eq("is_active", true)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(40);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const all = (data ?? []) as Alert[];
    const dismissed = await loadAlertIdsDismissedByUser(supabase, user.id);
    const visible = all.filter((alert) => !dismissed.has(alert.id));
    const page = visible.slice(0, 10);
    const states = await loadAlertUserStatesMap(
      supabase,
      user.id,
      page.map((a) => a.id),
    );
    const alerts = attachUserAlertState(page, states);

    return NextResponse.json(
      {
        total: visible.length,
        alerts: alerts.map((a) => ({
          id: a.id,
          title: a.title,
          message: a.message,
          severity: a.severity,
          alertType: a.alert_type,
          dueAt: a.due_at,
        })),
        polledAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
