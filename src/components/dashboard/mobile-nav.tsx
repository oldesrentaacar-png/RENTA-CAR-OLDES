"use client";

import Image from "next/image";

import { SidebarNavContent } from "@/components/dashboard/sidebar";
import { Drawer } from "@/components/ui/drawer";
import { BRAND } from "@/lib/brand";

export type MobileNavProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Menú"
      side="left"
      className="w-[min(100%,18rem)]"
    >
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <Image
          src={BRAND.logoPath}
          alt={BRAND.fullName}
          width={120}
          height={48}
          className="h-10 w-auto rounded-md object-contain"
        />
        <div>
          <p className="text-sm font-bold text-sidebar-fg-active">{BRAND.name}</p>
          <p className="text-xs text-sidebar-fg">{BRAND.tagline}</p>
        </div>
      </div>
      <SidebarNavContent onNavigate={() => onOpenChange(false)} />
    </Drawer>
  );
}
