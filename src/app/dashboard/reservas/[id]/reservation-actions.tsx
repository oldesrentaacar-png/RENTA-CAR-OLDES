"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cancelReservation } from "@/app/dashboard/reservas/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { Button } from "@/components/ui/button";
import type { Reservation } from "@/types/database";

type LinkedContract = {
  id: string;
  code: string;
  status: string;
  closed_at: string | null;
};

export function ReservationDetailActions({
  reservation,
  linkedContract,
}: {
  reservation: Reservation;
  linkedContract?: LinkedContract | null;
}) {
  const router = useRouter();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };

  if (reservation.status === "CANCELLED") return null;

  const hasOpenContract =
    Boolean(linkedContract) && linkedContract!.status !== "COMPLETED";

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {linkedContract ? (
          <PermissionGuard permission="contracts.view" fallback={null}>
            <Link
              href={`/dashboard/contratos/${linkedContract.id}`}
              className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Ver contrato {linkedContract.code}
            </Link>
          </PermissionGuard>
        ) : (
          <PermissionGuard permission="contracts.create" fallback={null}>
            <Link
              href={`/dashboard/contratos/nuevo?reservation_id=${reservation.id}`}
              className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Crear contrato
            </Link>
          </PermissionGuard>
        )}
        <PermissionGuard permission="inspections.create" fallback={null}>
          <Link
            href={
              linkedContract
                ? `/dashboard/inspecciones/nuevo?reservation_id=${reservation.id}&contract_id=${linkedContract.id}`
                : `/dashboard/inspecciones/nuevo?reservation_id=${reservation.id}`
            }
            className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Nueva inspección
          </Link>
        </PermissionGuard>
        {!hasOpenContract ? (
          <PermissionGuard permission="reservations.cancel" fallback={null}>
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (!confirm("¿Cancelar esta reserva?")) return;
                const fd = new FormData();
                const result = await cancelReservation(reservation.id, fd);
                if (!result.success) setError(result.error);
                else router.refresh();
              }}
            >
              Cancelar reserva
            </Button>
          </PermissionGuard>
        ) : null}
      </div>

      <p className="text-xs text-muted">
        {hasOpenContract
          ? "Esta reserva ya migró al contrato. Extienda fechas, cambie montos o cancele desde el contrato."
          : "Siguiente paso típico: contrato → firma → inspección de salida."}
      </p>
    </div>
  );
}
