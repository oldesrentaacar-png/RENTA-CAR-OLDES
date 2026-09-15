"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteInspection } from "@/app/dashboard/inspecciones/actions";
import { usePermissions } from "@/components/auth/permission-provider";
import { Button } from "@/components/ui/button";

type InspectionDetailHeaderActionsProps = {
  inspectionId: string;
  inspectionCode: string;
  reservationId: string;
  showDeliveryContinue?: boolean;
  contractId?: string | null;
};

export function InspectionDetailHeaderActions({
  inspectionId,
  inspectionCode,
  reservationId,
  showDeliveryContinue = false,
  contractId = null,
}: InspectionDetailHeaderActionsProps) {
  const router = useRouter();
  const { has } = usePermissions();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canEdit = has("inspections.edit");

  function handleDelete() {
    const ok = window.confirm(
      `¿Eliminar la inspección ${inspectionCode}?\n\nSe borrarán de forma permanente el checklist, fotos y marcas de daño. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteInspection(inspectionId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/inspecciones");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {showDeliveryContinue && contractId ? (
          <Link
            href={`/dashboard/contratos/${contractId}#entrega`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
          >
            Continuar entrega
          </Link>
        ) : (
          <>
            <Link
              href={`/dashboard/contratos/nuevo?reservation_id=${reservationId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              Crear contrato
            </Link>
            <Link
              href={`/dashboard/inspecciones/${inspectionId}/comparar?reservation_id=${reservationId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
            >
              Comparar salida/entrada
            </Link>
          </>
        )}
        {canEdit ? (
          <>
            <Link
              href={`/dashboard/inspecciones/${inspectionId}/edit`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Editar
            </Link>
            <Button
              type="button"
              variant="danger"
              disabled={pending}
              onClick={handleDelete}
            >
              {pending ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
