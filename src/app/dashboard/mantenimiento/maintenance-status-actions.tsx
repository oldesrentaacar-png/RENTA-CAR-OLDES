"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateMaintenanceStatus } from "@/app/dashboard/mantenimiento/actions";
import { Button } from "@/components/ui/button";
import type { MaintenanceStatus } from "@/types/database";

const NEXT_STATUS: Partial<Record<MaintenanceStatus, MaintenanceStatus>> = {
  SCHEDULED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

type MaintenanceStatusActionsProps = {
  id: string;
  currentStatus: MaintenanceStatus;
};

export function MaintenanceStatusActions({
  id,
  currentStatus,
}: MaintenanceStatusActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [setVehicleMaintenance, setSetVehicleMaintenance] = useState(true);
  const [pending, startTransition] = useTransition();

  const nextStatus = NEXT_STATUS[currentStatus];

  if (!nextStatus) {
    return null;
  }

  const handleAdvance = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateMaintenanceStatus(
        id,
        nextStatus,
        nextStatus === "IN_PROGRESS" && setVehicleMaintenance,
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {nextStatus === "IN_PROGRESS" ? (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={setVehicleMaintenance}
            onChange={(event) => setSetVehicleMaintenance(event.target.checked)}
          />
          Marcar vehículo en mantenimiento
        </label>
      ) : null}
      <Button type="button" size="sm" onClick={handleAdvance} disabled={pending}>
        {pending
          ? "Actualizando…"
          : nextStatus === "IN_PROGRESS"
            ? "Iniciar servicio"
            : "Completar servicio"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
