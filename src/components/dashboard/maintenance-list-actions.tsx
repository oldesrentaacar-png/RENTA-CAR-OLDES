"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteMaintenanceRecord } from "@/app/dashboard/mantenimiento/actions";
import { usePermissions } from "@/components/auth/permission-provider";
import { Button } from "@/components/ui/button";

export function MaintenanceListActions({
  recordId,
}: {
  recordId: string;
}) {
  const router = useRouter();
  const { has } = usePermissions();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [pending, startTransition] = useTransition();
  const canEdit = has("maintenance.edit");

  if (!canEdit) {
    return (
      <Link
        href={`/dashboard/mantenimiento/${recordId}`}
        className="text-sm text-brand hover:underline"
      >
        Ver
      </Link>
    );
  }

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
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={`/dashboard/mantenimiento/${recordId}`}
          className="inline-flex min-h-9 items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
        >
          Editar
        </Link>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={handleDelete}
        >
          {pending ? "Eliminando…" : "Eliminar"}
        </Button>
      </div>
      {error ? (
        <p className="max-w-[16rem] text-right text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
