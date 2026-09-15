"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteVehicle } from "@/app/dashboard/vehiculos/actions";
import { usePermissions } from "@/components/auth/permission-provider";
import { Button } from "@/components/ui/button";

type VehicleListActionsProps = {
  vehicleId: string;
};

export function VehicleListActions({ vehicleId }: VehicleListActionsProps) {
  const router = useRouter();
  const { has } = usePermissions();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canEdit = has("vehicles.edit");
  const canDelete = has("vehicles.archive");

  if (!canEdit && !canDelete) return null;

  function handleDelete() {
    const ok = window.confirm(
      "¿Eliminar este vehículo de la flota?\n\nSe ocultará del listado (los historiales de reservas/contratos se conservan). Si tiene reservas o contratos abiertos, no se podrá eliminar.",
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteVehicle(vehicleId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {canEdit ? (
          <Link
            href={`/dashboard/vehiculos/${vehicleId}/edit`}
            className="inline-flex min-h-9 items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
          >
            Editar
          </Link>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Eliminando…" : "Eliminar"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="max-w-[16rem] text-right text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
