"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";

/** Bump this key to show the notice again after a prior dismiss. */
const NOTICE_STORAGE_KEY = "oldes.system-notice.problems-resolved.v1";

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
      className="shrink-0 border-b border-emerald-700/40 bg-emerald-800 px-3 py-2.5 text-white sm:px-4 lg:px-6"
    >
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-200" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm leading-snug text-white">
          Los problemas reportados ya fueron solucionados.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Cerrar aviso"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
