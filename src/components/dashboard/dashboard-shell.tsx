"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { Topbar } from "@/components/dashboard/topbar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
      <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
      <main
        className={[
          "flex-1 overflow-y-auto overscroll-y-contain p-4",
          "[-webkit-overflow-scrolling:touch] lg:p-6",
          // Espacio para barra inferior tipo app (solo móvil)
          "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-4 lg:pb-6",
        ].join(" ")}
      >
        {children}
      </main>
      <MobileBottomNav onOpenMore={() => setMobileNavOpen(true)} />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </div>
  );
}
