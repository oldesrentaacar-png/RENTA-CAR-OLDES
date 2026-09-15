"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteVehicle } from "@/app/dashboard/vehiculos/actions";
import { usePermissions } from "@/components/auth/permission-provider";
import { Button } from "@/components/ui/button";

export function VehicleDetailHeaderActions({
  vehicleId,
}: {
  vehicleId: string;
}) {
  const router = useRouter();
  const { has } = usePermissions();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canEdit = has("vehicles.edit");
  const canDelete = has("vehicles.archive");

  if (!canEdit && !canDelete) return null;

  function handleDelete() {
    const ok = window.confirm(
      "¿Eliminar este vehículo de la flota?\n\nDesaparecerá del listado. El historial se conserva. Si tiene reservas/contratos abiertos, no se podrá eliminar.",
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteVehicle(vehicleId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/vehiculos");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Link
            href={`/dashboard/vehiculos/${vehicleId}/edit`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Editar
          </Link>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Eliminando…" : "Eliminar"}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
