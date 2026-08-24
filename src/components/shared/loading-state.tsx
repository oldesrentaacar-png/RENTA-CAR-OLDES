import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type LoadingStateProps = {
  message?: string;
  className?: string;
};

export function LoadingState({
  message = "Cargando…",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-muted",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
