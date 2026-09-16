"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

/** Bump this key to show the notice again after a prior dismiss. */
const NOTICE_STORAGE_KEY = "oldes.system-notice.errors-priority.v2";

export function SystemNoticeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(NOTICE_STORAGE_KEY) === "dismissed") {
        return;
      }
    } catch {
      // localStorage may be unavailable; still show the notice.
    }
    setVisible(true);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(NOTICE_STORAGE_KEY, "dismissed");
    } catch {
      // Ignore storage errors; hide for this session anyway.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="shrink-0 border-b-4 border-accent bg-brand px-3 py-3 text-white shadow-md sm:px-4 lg:px-6"
    >
      <div className="flex items-start gap-3 sm:items-center">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm ring-2 ring-white/30 sm:mt-0">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-light">
            Aviso WebBoost · Prioridad absoluta
          </p>
          <p className="text-sm font-semibold leading-snug text-white sm:text-base">
            Todos los errores reportados están siendo trabajados. Pronto se le
            notificará. Estamos dando prioridad absoluta a su atención.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Cerrar aviso"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
