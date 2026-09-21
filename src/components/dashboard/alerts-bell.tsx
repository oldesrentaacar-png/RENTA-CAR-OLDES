"use client";

import Link from "next/link";
import { Bell, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  dismissAllAlertsForMe,
  dismissAlertForMe,
  fetchActiveAlerts,
  markAlertRead,
} from "@/app/dashboard/alertas/actions";
import { ALERT_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types/database";

declare global {
  interface Window {
    AndroidBridge?: {
      notifyAlerts?: (count: number, title: string, body: string) => void;
      requestNotificationPermission?: () => void;
    };
    __oldesLastAlert?: number;
  }
}

function alertHref(alert: Alert): string | null {
  if (alert.entity_type === "web_request" && alert.entity_id) {
    return `/dashboard/solicitudes/${alert.entity_id}`;
  }
  if (alert.entity_type === "reservation" && alert.entity_id) {
    return `/dashboard/reservas/${alert.entity_id}`;
  }
  if (alert.entity_type === "contract" && alert.entity_id) {
    return `/dashboard/contratos/${alert.entity_id}`;
  }
  if (alert.entity_type === "maintenance" && alert.entity_id) {
    return `/dashboard/mantenimiento/${alert.entity_id}`;
  }
  return null;
}

export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (panelRef.current && target && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = window.AndroidBridge;
    if (!bridge || typeof bridge.notifyAlerts !== "function") return;
    if (window.__oldesLastAlert === total) return;
    window.__oldesLastAlert = total;
    try {
      bridge.notifyAlerts(
        total,
        "OLDES Sistema",
        total > 0
          ? `Tienes ${total} alerta(s) pendiente(s)`
          : "No tienes alertas pendientes",
      );
    } catch {
      // El puente no está disponible (web normal): ignorar.
    }
  }, [total]);

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markAlertRead(id);
      loadAlerts();
    });
  };

  const handleDismiss = (id: string) => {
    startTransition(async () => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      await dismissAlertForMe(id);
      loadAlerts();
    });
  };

  const handleDismissAll = () => {
    startTransition(async () => {
      setAlerts([]);
      setTotal(0);
      await dismissAllAlertsForMe();
      loadAlerts();
    });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            if (next) loadAlerts();
            return next;
          });
        }}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
        aria-label="Alertas"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {total > 0 ? (
          <span
            data-alerts-count={total}
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white"
          >
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      <span data-alerts-count={total} className="hidden" aria-hidden="true" />

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-border bg-surface shadow-lg sm:w-80">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Mis avisos</p>
              <p className="text-[11px] text-muted">
                Solo se quitan de tu perfil
              </p>
            </div>
            <div className="flex items-center gap-2">
              {total > 0 ? (
                <button
                  type="button"
                  onClick={handleDismissAll}
                  className="text-xs text-muted hover:underline"
                  disabled={pending}
                >
                  Quitar todas
                </button>
              ) : null}
              <Link
                href="/dashboard/alertas"
                className="text-xs text-brand hover:underline"
                onClick={() => setOpen(false)}
              >
                Ver todas
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label="Cerrar avisos"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {pending && alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">
                Cargando…
              </p>
            ) : alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">
                No tienes avisos pendientes.
              </p>
            ) : (
              alerts.map((alert) => {
                const href = alertHref(alert);
                return (
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
                    {alert.alert_type === "webboost_notice" ? (
                      <p className="text-sm font-semibold text-brand">
                        {alert.title}
                      </p>
                    ) : href ? (
                      <Link
                        href={href}
                        className="text-sm font-medium text-brand hover:underline"
                        onClick={() => {
                          void markAlertRead(alert.id);
                          setOpen(false);
                        }}
                      >
                        {alert.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{alert.title}</p>
                    )}
                    {alert.message ? (
                      <p className="mt-1 text-xs text-muted">{alert.message}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-3">
                      {!alert.is_read ? (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(alert.id)}
                          className="text-xs text-brand hover:underline"
                          disabled={pending}
                        >
                          Marcar leída
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDismiss(alert.id)}
                        className="text-xs font-medium text-zinc-800 hover:underline"
                        disabled={pending}
                      >
                        Quitar de mis avisos
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
