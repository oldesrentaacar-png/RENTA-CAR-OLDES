"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

/** Bump this key to show the notice again after a prior dismiss. */
const NOTICE_STORAGE_KEY = "oldes.system-notice.errors-priority.v1";

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
      className="shrink-0 border-b border-sky-200 bg-sky-50 px-3 py-2.5 text-sky-950 sm:px-4 lg:px-6"
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-sm leading-relaxed">
          Todos los errores reportados están siendo trabajados. Se le notificará
          pronto. Se está dando{" "}
          <span className="font-semibold">prioridad absoluta</span>.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sky-800 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          aria-label="Cerrar aviso"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
