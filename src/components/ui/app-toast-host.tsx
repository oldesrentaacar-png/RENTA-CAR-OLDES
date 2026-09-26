"use client";

import { useEffect, useState } from "react";

import {
  APP_NOTICE_EVENT,
  type AppNotice,
} from "@/lib/ui/announce";

export function AppToastHost() {
  const [items, setItems] = useState<AppNotice[]>([]);

  useEffect(() => {
    function onNotice(event: Event) {
      const detail = (event as CustomEvent<AppNotice>).detail;
      if (!detail?.message) return;
      setItems((current) => [...current.slice(-3), detail]);
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== detail.id));
      }, 4500);
    }
    window.addEventListener(APP_NOTICE_EVENT, onNotice);
    return () => window.removeEventListener(APP_NOTICE_EVENT, onNotice);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            item.tone === "ok"
              ? "pointer-events-auto max-w-md rounded-full bg-emerald-800 px-4 py-2 text-center text-sm font-medium text-white shadow-lg"
              : item.tone === "warn"
                ? "pointer-events-auto max-w-md rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow-lg"
                : "pointer-events-auto max-w-md rounded-full bg-red-700 px-4 py-2 text-center text-sm font-medium text-white shadow-lg"
          }
          onClick={() =>
            setItems((current) => current.filter((row) => row.id !== item.id))
          }
        >
          {item.message}
        </button>
      ))}
    </div>
  );
}
