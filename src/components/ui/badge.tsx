import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variants = {
  default: "bg-surface-muted text-foreground border-border",
  brand: "bg-brand-light text-brand-dark border-brand/20",
  success: "bg-green-50 text-green-800 border-green-200",
  warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
  danger: "bg-red-50 text-red-800 border-red-200",
  info: "bg-blue-50 text-blue-800 border-blue-200",
  outline: "bg-transparent text-muted border-border",
} as const;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
