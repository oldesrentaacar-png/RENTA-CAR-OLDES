"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-brand text-white hover:bg-brand-dark shadow-sm disabled:opacity-50",
  secondary:
    "bg-white text-foreground border border-border hover:bg-surface-muted disabled:opacity-50",
  ghost: "text-foreground hover:bg-surface-muted disabled:opacity-50",
  danger:
    "bg-accent text-white hover:bg-red-700 shadow-sm disabled:opacity-50",
  outline:
    "border border-brand text-brand hover:bg-brand-light disabled:opacity-50",
  sidebar:
    "text-sidebar-fg hover:bg-sidebar-bg-hover hover:text-sidebar-fg-active disabled:opacity-50",
} as const;

const sizes = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-sm gap-2",
  icon: "h-9 w-9 p-0",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Cargando…</span>
        </>
      ) : (
        children
      )}
    </button>
  ),
);

Button.displayName = "Button";
