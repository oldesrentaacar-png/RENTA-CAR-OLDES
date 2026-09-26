"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteInspection } from "@/app/dashboard/inspecciones/actions";
import { usePermissions } from "@/components/auth/permission-provider";
import { Button } from "@/components/ui/button";

type InspectionListActionsProps = {
  inspectionId: string;
  inspectionCode: string;
};

export function InspectionListActions({
  inspectionId,
  inspectionCode,
}: InspectionListActionsProps) {
  const router = useRouter();
  const { has } = usePermissions();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [pending, startTransition] = useTransition();

  const canEdit = has("inspections.edit");

  if (!canEdit) return null;

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
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={`/dashboard/inspecciones/${inspectionId}/edit`}
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
