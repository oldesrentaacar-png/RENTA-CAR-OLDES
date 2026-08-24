import Image from "next/image";
import Link from "next/link";

import { DashboardNav } from "@/components/dashboard/nav";
import { BRAND } from "@/lib/brand";

export function DashboardShell({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src={BRAND.logoPath}
              alt={BRAND.fullName}
              width={140}
              height={56}
              className="h-10 w-auto rounded-md object-contain"
            />
            <span className="text-lg font-semibold text-zinc-900">
              {BRAND.fullName}
            </span>
          </Link>
          <span className="text-sm text-zinc-500">Panel administrativo</span>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <DashboardNav pathname={pathname} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
