"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cancelReservation } from "@/app/dashboard/reservas/actions";
import { Button } from "@/components/ui/button";
import type { Reservation } from "@/types/database";

export function ReservationDetailActions({ reservation }: { reservation: Reservation }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  if (reservation.status === "CANCELLED") return null;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/dashboard/contratos/nuevo?reservation_id=${reservation.id}`}
          className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Crear contrato
        </Link>
        <Link
          href={`/dashboard/inspecciones/nuevo?reservation_id=${reservation.id}`}
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Nueva inspección
        </Link>
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
      </div>

      <p className="text-xs text-muted">
        Siguiente paso típico: contrato → firma → inspección de salida.
      </p>
    </div>
  );
}
