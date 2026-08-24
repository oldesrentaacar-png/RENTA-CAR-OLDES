"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean | string;
  label?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    const hasError = Boolean(error);

    return (
      <div className={label || (typeof error === "string" && error) ? "space-y-1" : undefined}>
        {label ? (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            hasError ? "border-danger" : "border-border hover:border-border-strong",
            className,
          )}
          {...props}
        />
        {typeof error === "string" && error ? (
          <p className="text-xs text-danger">{error}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
