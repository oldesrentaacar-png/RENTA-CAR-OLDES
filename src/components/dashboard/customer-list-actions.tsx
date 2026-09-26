"use client";

import { announceError } from "@/lib/ui/announce";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteCustomer } from "@/app/dashboard/clientes/actions";
import { usePermissions } from "@/components/auth/permission-provider";
import { Button } from "@/components/ui/button";

export function CustomerListActions({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const { has } = usePermissions();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (value: string | null) => {
    setErrorState(value);
    if (value) announceError(value);
  };
  const [pending, startTransition] = useTransition();

  const canEdit = has("customers.edit");
  const canDelete = has("customers.delete");

  if (!canEdit && !canDelete) return null;

  function handleDelete() {
    const ok = window.confirm(
      `¿Eliminar al cliente ${customerName}?\n\nDesaparecerá del listado (soft-delete).`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCustomer(customerId);
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
            href={`/dashboard/clientes/${customerId}/edit`}
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
