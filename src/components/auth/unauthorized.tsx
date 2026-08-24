import { ShieldX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UnauthorizedProps = {
  compact?: boolean;
  title?: string;
  description?: string;
};

export function Unauthorized({
  compact = false,
  title = "Acceso restringido",
  description = "No tiene permisos para ver este contenido. Contacte al administrador si cree que esto es un error.",
}: UnauthorizedProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-12 px-4" : "min-h-[50vh] py-16 px-6",
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-accent">
        <ShieldX className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      {!compact ? (
        <Link href="/dashboard" className="mt-6">
          <Button variant="secondary">Volver al panel</Button>
        </Link>
      ) : null}
    </div>
  );
}
