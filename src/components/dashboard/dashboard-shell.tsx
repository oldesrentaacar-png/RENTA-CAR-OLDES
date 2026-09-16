"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { SystemNoticeBanner } from "@/components/dashboard/system-notice-banner";
import { Topbar } from "@/components/dashboard/topbar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
      <SystemNoticeBanner />
      <main
        className={[
          // min-h-0 es obligatorio en flex para que overflow-y-auto haga scroll
          "min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4",
          "[-webkit-overflow-scrolling:touch] touch-pan-y sm:px-4 lg:p-6",
          // Espacio para barra inferior tipo app (solo móvil)
          "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-4 lg:pb-6",
        ].join(" ")}
      >
        {children}
      </main>
      <MobileBottomNav onOpenMore={() => setMobileNavOpen(true)} />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </div>
  );
}
