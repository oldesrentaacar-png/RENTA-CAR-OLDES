"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  fetchActiveAlerts,
  markAlertRead,
  resolveAlert,
} from "@/app/dashboard/alertas/actions";
import { ALERT_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types/database";

export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [pending, startTransition] = useTransition();

  const loadAlerts = () => {
    startTransition(async () => {
      const result = await fetchActiveAlerts(8);
      if (result.success) {
        setAlerts(result.data.alerts);
        setTotal(result.data.total);
      }
    });
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markAlertRead(id);
      loadAlerts();
    });
  };

  const handleResolve = (id: string) => {
    startTransition(async () => {
      await resolveAlert(id);
      loadAlerts();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) loadAlerts();
        }}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
        aria-label="Alertas"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {total > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 touch-none bg-black/10"
            onPointerDown={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-border bg-surface shadow-lg sm:w-80"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Alertas activas</p>
              <Link
                href="/dashboard/alertas"
                className="text-xs text-brand hover:underline"
                onClick={() => setOpen(false)}
              >
                Ver todas
              </Link>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {pending && alerts.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  Cargando…
                </p>
              ) : alerts.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  No hay alertas activas.
                </p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "border-b border-border px-4 py-3 last:border-b-0",
                      !alert.is_read && "bg-brand/5",
                    )}
                  >
                    <p className="text-xs text-muted">
                      {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
                    </p>
                    <p className="text-sm font-medium">{alert.title}</p>
                    {alert.message ? (
                      <p className="mt-1 text-xs text-muted">{alert.message}</p>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      {!alert.is_read ? (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(alert.id)}
                          className="text-xs text-brand hover:underline"
                        >
                          Marcar leída
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleResolve(alert.id)}
                        className="text-xs text-muted hover:underline"
                      >
                        Resolver
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
