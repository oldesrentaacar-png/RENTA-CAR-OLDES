"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cancelReservation } from "@/app/dashboard/reservas/actions";
import { usePermissions } from "@/components/auth/permission-provider";
import { Button } from "@/components/ui/button";

export function ReservationListActions({
  reservationId,
  reservationCode,
  status,
}: {
  reservationId: string;
  reservationCode: string;
  status: string;
}) {
  const router = useRouter();
  const { has } = usePermissions();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [pending, startTransition] = useTransition();

  const canEdit = has("reservations.edit");
  const canCancel = has("reservations.cancel");
  const cancelled = status === "CANCELLED";

  if (cancelled || (!canEdit && !canCancel)) return null;

  function handleCancel() {
    const ok = window.confirm(
      `¿Cancelar la reserva ${reservationCode}?\n\nSi tiene contratos abiertos, no se podrá cancelar.`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelReservation(reservationId, new FormData());
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
            href={`/dashboard/reservas/${reservationId}/edit`}
            className="inline-flex min-h-9 items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
          >
            Editar
          </Link>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={handleCancel}
          >
            {pending ? "Cancelando…" : "Cancelar"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="max-w-[16rem] text-right text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
