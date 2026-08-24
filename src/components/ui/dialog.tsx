"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = "md",
}: DialogProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        className={cn(
          "relative z-10 w-full rounded-xl border border-border bg-surface shadow-lg",
          sizes[size],
          className,
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              {title ? (
                <h2 id="dialog-title" className="text-lg font-semibold">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-1 text-sm text-muted">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
