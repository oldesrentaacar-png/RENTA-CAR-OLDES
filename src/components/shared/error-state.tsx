import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Algo salió mal",
  message = "No se pudo cargar la información. Intente de nuevo.",
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 px-6 py-16 text-center",
        className,
      )}
      role="alert"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-accent">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted">{message}</p>
      <div className="mt-6 flex gap-2">
        {onRetry ? (
          <Button type="button" variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}
