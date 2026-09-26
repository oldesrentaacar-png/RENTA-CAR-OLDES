"use client";

import { announceError } from "@/lib/ui/announce";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteMaintenanceRecord } from "@/app/dashboard/mantenimiento/actions";
import { Button } from "@/components/ui/button";

export function MaintenanceDeleteButton({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const ok = window.confirm(
      "¿Eliminar este registro de mantenimiento?\n\nSe ocultará del listado (soft-delete).",
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMaintenanceRecord(recordId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/mantenimiento");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="danger"
        disabled={pending}
        onClick={handleDelete}
      >
        {pending ? "Eliminando…" : "Eliminar registro"}
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
