"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteWebRequest } from "@/app/dashboard/solicitudes/actions";
import { usePermissions } from "@/components/auth/permission-provider";
import { Button } from "@/components/ui/button";

type RequestListActionsProps = {
  requestId: string;
  requestCode: string;
  status: string;
};

export function RequestListActions({
  requestId,
  requestCode,
  status,
}: RequestListActionsProps) {
  const router = useRouter();
  const { has } = usePermissions();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canEdit = has("requests.edit");
  const canDelete = has("requests.delete");
  const closed = ["CONVERTED", "REJECTED", "CANCELLED"].includes(status);

  if (!canEdit && !canDelete) return null;

  function handleDelete() {
    const ok = window.confirm(
      `¿Eliminar la solicitud ${requestCode}?\n\nDesaparecerá del listado (soft-delete).`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteWebRequest(requestId);
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
        {canEdit && !closed ? (
          <Link
            href={`/dashboard/solicitudes/${requestId}/edit`}
            className="inline-flex min-h-9 items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
          >
            Editar
          </Link>
        ) : null}
        {canDelete && status !== "CONVERTED" ? (
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
