import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-[140px] flex-1 flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}
